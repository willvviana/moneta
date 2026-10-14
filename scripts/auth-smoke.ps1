# Auth smoke test. Run via: op run --env-file=.env.test.op -- powershell -File scripts\auth-smoke.ps1
# The password comes from $env:TEST_PASSWORD (injected by 1Password), never from this file.
$base = "http://localhost:3000/api/auth"
$email = "smoke-$([guid]::NewGuid().ToString('N').Substring(0,8))@example.com"
$s = New-Object Microsoft.PowerShell.Commands.WebRequestSession   # holds the cookie jar
$json = "application/json"
$good = @{ email = $email; password = $env:TEST_PASSWORD } | ConvertTo-Json
$bad  = @{ email = $email; password = "definitely-wrong-password" } | ConvertTo-Json

function Check($label, $expected, [scriptblock]$call) {
  try { $r = & $call; $code = 200; if ($r -ne $null -and $r.PSObject.Properties["StatusCode"]) { $code = $r.StatusCode } }
  catch { $code = [int]$_.Exception.Response.StatusCode }
  $mark = if ($code -eq $expected) { "PASS" } else { "FAIL" }
  Write-Host ("{0}  {1}  (expected {2}, got {3})" -f $mark, $label, $expected, $code)
}
function Call($method, $path, $body, $headers = @{}) {
  Invoke-WebRequest -UseBasicParsing -Method $method -Uri "$base$path" -WebSession $s -ContentType $json -Body $body -Headers $headers
}

Check "register"                       201 { Call Post "/register" $good }
Check "me while logged in"             200 { Call Get  "/me" $null }
Check "register same email again"      409 { Call Post "/register" $good }
Check "logout"                         204 { Call Post "/logout" $null }
Check "me after logout"                401 { Call Get  "/me" $null }
Check "login wrong password"           401 { Call Post "/login" $bad }
Check "login correct password"         200 { Call Post "/login" $good }
Check "me after login"                 200 { Call Get  "/me" $null }
Check "POST from foreign Origin"       403 { Call Post "/logout" $null @{ Origin = "http://evil.test" } }
