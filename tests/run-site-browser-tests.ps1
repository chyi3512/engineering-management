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
foreach($phase in $Phases){
  if($phase -eq 'mobile'){
    Send-DailyCdp 'Emulation.setDeviceMetricsOverride' @{width=390;height=844;deviceScaleFactor=1;mobile=$true}|Out-Null
    Send-DailyCdp 'Emulation.setTouchEmulationEnabled' @{enabled=$true;maxTouchPoints=1}|Out-Null
  }
  Send-DailyCdp 'Page.navigate' @{url="http://127.0.0.1:8767/tests/project-site-test.html?phase=$phase"}|Out-Null
  $complete=$false
  for($i=0;$i -lt 180;$i++){
    Start-Sleep -Milliseconds 250
    $state=Evaluate-Daily '({title:document.title,results:document.getElementById("dailyTestResults")?.textContent||"",errors:window.dailyTestErrors||[]})'
    if($state.title -in @('PASS','FAIL')){$complete=$true;break}
  }
  $state.results | Set-Content -Encoding UTF8 (Join-Path $PSScriptRoot "site-$phase-results.txt")
  $state.errors | ConvertTo-Json | Set-Content -Encoding UTF8 (Join-Path $PSScriptRoot "site-$phase-console.json")
  Write-Output "$phase : $($state.title)"
  Write-Output $state.results
  if(-not $complete -or $state.title -eq 'FAIL'){break}
  if($phase -eq 'mobile'){
    Evaluate-Daily 'window.scrollTo(0,0);true'|Out-Null
    Start-Sleep -Milliseconds 400
    $point=Evaluate-Daily '(()=>{const e=document.querySelector("[data-site-check]"),r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,checked:e.checked};})()'
    Send-DailyCdp 'Input.dispatchTouchEvent' @{type='touchStart';touchPoints=@(@{x=$point.x;y=$point.y})}|Out-Null
    Send-DailyCdp 'Input.dispatchTouchEvent' @{type='touchEnd';touchPoints=@()}|Out-Null
    Start-Sleep -Milliseconds 400
    $checked=Evaluate-Daily 'document.querySelector("[data-site-check]").checked'
    if($checked -eq $point.checked){throw 'Touch checkbox did not toggle'}
    Add-Content -Encoding UTF8 (Join-Path $PSScriptRoot 'site-mobile-results.txt') 'PASS physical touch event toggles checklist'
    Evaluate-Daily 'window.scrollTo(0,0);true'|Out-Null
    $shot=Send-DailyCdp 'Page.captureScreenshot' @{format='png';captureBeyondViewport=$false}
    [IO.File]::WriteAllBytes((Join-Path $PSScriptRoot 'site-mobile.png'),[Convert]::FromBase64String($shot.data))
    Evaluate-Daily 'document.querySelector("[data-site-photos]").scrollIntoView({block:"start"});true'|Out-Null
    $shot=Send-DailyCdp 'Page.captureScreenshot' @{format='png';captureBeyondViewport=$false}
    [IO.File]::WriteAllBytes((Join-Path $PSScriptRoot 'site-mobile-photos.png'),[Convert]::FromBase64String($shot.data))
  }
}
$socket.Dispose()
