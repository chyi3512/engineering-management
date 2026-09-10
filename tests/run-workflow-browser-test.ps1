param([int]$Port=9227)
$ErrorActionPreference='Stop'
$targets=Invoke-RestMethod "http://127.0.0.1:$Port/json"
$target=$targets | Where-Object type -eq 'page' | Select-Object -First 1
$socket=[System.Net.WebSockets.ClientWebSocket]::new()
$socket.ConnectAsync([Uri]$target.webSocketDebuggerUrl,[Threading.CancellationToken]::None).GetAwaiter().GetResult()
$script:workflowCdpId=0
function Send-WorkflowCdp([string]$Method,$Params=@{}) {
  $script:workflowCdpId++
  $id=$script:workflowCdpId
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
function Evaluate-Workflow([string]$Expression){
  $value=Send-WorkflowCdp 'Runtime.evaluate' @{expression=$Expression;returnByValue=$true;awaitPromise=$true}
  if($value.exceptionDetails){throw ($value.exceptionDetails|ConvertTo-Json -Depth 8)}
  return $value.result.value
}
Send-WorkflowCdp 'Page.enable' | Out-Null
Send-WorkflowCdp 'Page.navigate' @{url='http://127.0.0.1:8769/tests/workflow-test.html'} | Out-Null
for($i=0;$i -lt 160;$i++){
  Start-Sleep -Milliseconds 250
  $state=Evaluate-Workflow '({title:document.title,results:document.getElementById("workflowTestResults")?.textContent||"",errors:window.workflowTestErrors||[]})'
  if($state.title -in @('PASS','FAIL')){break}
}
$socket.Dispose()
Write-Output "workflow : $($state.title)"
Write-Output $state.results
if($state.title -ne 'PASS'){throw 'Workflow browser test failed'}
