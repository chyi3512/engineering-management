param([string[]]$Phases=@('create','reload'),[int]$Port=9226)
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
  Send-DailyCdp 'Page.navigate' @{url="http://127.0.0.1:8767/tests/regression.html?$phase"}|Out-Null
  for($i=0;$i -lt 160;$i++){
    Start-Sleep -Milliseconds 250
    $state=Evaluate-Daily '({title:document.title,results:document.getElementById("results")?.textContent||"",errors:window.testErrors||[]})'
    if($state.title -in @('PASS','FAIL')){break}
  }
  $state.results | Set-Content -Encoding UTF8 (Join-Path $PSScriptRoot "site-regression-$phase-results.txt")
  Write-Output "$phase : $($state.title)"
  Write-Output $state.results
  if($state.title -ne 'PASS'){throw 'Original regression failed'}
}
$socket.Dispose()
