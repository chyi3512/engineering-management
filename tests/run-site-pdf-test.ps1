param([string[]]$Phases=@('create','reload','mobile'),[int]$Port=9226)
$ErrorActionPreference='Stop'
$targets=Invoke-RestMethod "http://127.0.0.1:$Port/json"
$target=$targets | Where-Object type -eq 'page' | Select-Object -First 1
$socket=[System.Net.WebSockets.ClientWebSocket]::new()
$socket.ConnectAsync([Uri]$target.webSocketDebuggerUrl,[Threading.CancellationToken]::None).GetAwaiter().GetResult()
$script:dailyCdpId=0
function Send-DailyCdp([string]$Method,$Params=@{}) {
  $script:dailyCdpId++
  $id=$script:dailyCdpId
  $json=@{id=$id;method=$Method;params=$Params}|ConvertTo-Json -Depth 30 -Compress
  $bytes=[Text.Encoding]::UTF8.GetBytes($json)
  $socket.SendAsync([ArraySegment[byte]]::new($bytes),[Net.WebSockets.WebSocketMessageType]::Text,$true,[Threading.CancellationToken]::None).GetAwaiter().GetResult()
  do {
    $stream=[IO.MemoryStream]::new()
    do {
      $buffer=New-Object byte[] 65536
      $received=$socket.ReceiveAsync([ArraySegment[byte]]::new($buffer),[Threading.CancellationToken]::None).GetAwaiter().GetResult()
      $stream.Write($buffer,0,$received.Count)
    } while(-not $received.EndOfMessage)
    $response=[Text.Encoding]::UTF8.GetString($stream.ToArray())|ConvertFrom-Json
    $stream.Dispose()
  } while($response.id -ne $id)
  if($response.error){throw ($response.error|ConvertTo-Json)}
  return $response.result
}
function Evaluate-Daily([string]$Expression){
  $value=Send-DailyCdp 'Runtime.evaluate' @{expression=$Expression;returnByValue=$true;awaitPromise=$true}
  if($value.exceptionDetails){throw ($value.exceptionDetails|ConvertTo-Json -Depth 8)}
  return $value.result.value
}
Send-DailyCdp 'Page.enable' | Out-Null
Evaluate-Daily 'viewProjectSiteReport(siteTestProjectId,dailyProject(siteTestProjectId).siteReports[0].id);true'|Out-Null
$before=@((Invoke-RestMethod "http://127.0.0.1:$Port/json").id)
Send-DailyCdp 'Runtime.evaluate' @{expression='document.getElementById("psReportPDF").click();true';userGesture=$true;returnByValue=$true}|Out-Null
$newTarget=$null
for($i=0;$i -lt 40;$i++){
  Start-Sleep -Milliseconds 100
  $newTarget=Invoke-RestMethod "http://127.0.0.1:$Port/json" | ForEach-Object {$_} | Where-Object {$_.type -eq 'page' -and $_.id -notin $before} | Select-Object -First 1
  if($newTarget){break}
}
if(-not $newTarget){throw 'PDF button did not open print page'}
$socket.Dispose()
$socket=[System.Net.WebSockets.ClientWebSocket]::new()
$socket.ConnectAsync([Uri]$newTarget.webSocketDebuggerUrl,[Threading.CancellationToken]::None).GetAwaiter().GetResult()|Out-Null
Send-DailyCdp 'Page.enable'|Out-Null
for($i=0;$i -lt 60;$i++){
  Start-Sleep -Milliseconds 100
  $ready=Evaluate-Daily '!!document.querySelector(".site-report") && [...document.images].every(img=>img.complete && img.naturalWidth>0)'
  if($ready){break}
}
if(-not $ready){throw 'Print report photos did not load'}
$state=Evaluate-Daily '({title:document.title,photoCount:document.images.length,text:document.body.innerText})'
$state|ConvertTo-Json -Depth 4|Set-Content -Encoding UTF8 (Join-Path $PSScriptRoot 'site-pdf-results.json')
$pdf=Send-DailyCdp 'Page.printToPDF' @{preferCSSPageSize=$true;printBackground=$true}
[IO.File]::WriteAllBytes((Join-Path $PSScriptRoot 'site-report-test.pdf'),[Convert]::FromBase64String($pdf.data))
$shot=Send-DailyCdp 'Page.captureScreenshot' @{format='png';captureBeyondViewport=$true}
[IO.File]::WriteAllBytes((Join-Path $PSScriptRoot 'site-report-preview.png'),[Convert]::FromBase64String($shot.data))
Write-Output "PASS PDF button opens formal print page with $($state.photoCount) photos; PDF saved"
Send-DailyCdp 'Page.close'|Out-Null
$socket.Dispose()
