# Deliverex full-workflow end-to-end test
# Customer -> Job Order -> Best-Fit -> Assign -> Driver PWA -> OCR -> Admin Validate -> Tracking -> Manager
# Usage:  powershell -ExecutionPolicy Bypass -File e2e_workflow_test.ps1

$ErrorActionPreference = 'Stop'
$base = 'http://127.0.0.1:8002/api'
$pass = 0; $fail = 0
function Ok($m)   { Write-Host "  [PASS] $m" -ForegroundColor Green; $script:pass++ }
function Bad($m)  { Write-Host "  [FAIL] $m" -ForegroundColor Red;   $script:fail++ }
function Step($m) { Write-Host ""; Write-Host "== $m ==" -ForegroundColor Cyan }
function Login($email, $password) {
  (Invoke-RestMethod -Uri "$base/auth/login" -Method POST -ContentType 'application/json' `
     -Body (@{ email = $email; password = $password } | ConvertTo-Json)).token
}
function Hdr($token) { @{ Authorization = "Bearer $token"; Accept = 'application/json' } }

# ── Login all roles ──
Step '0. Authentication (all roles)'
$tDisp = Login 'dispatcher@deliverex.com' 'dispatcher123'; if ($tDisp) { Ok 'dispatcher login' } else { Bad 'dispatcher login' }
$tAdmin = Login 'admin@deliverex.com' 'admin123';          if ($tAdmin) { Ok 'admin login' } else { Bad 'admin login' }
$tMgr  = Login 'manager@deliverex.com' 'manager123';        if ($tMgr) { Ok 'manager login' } else { Bad 'manager login' }
$tDrv  = Login 'driver@deliverex.ph' 'driver123';           if ($tDrv) { Ok 'driver login' } else { Bad 'driver login' }

# ── Resolve demo driver's driver_id (auto-creates Driver row) ──
$drvProfile = Invoke-RestMethod -Uri "$base/driver/profile" -Headers (Hdr $tDrv)
$driverId = $drvProfile.id
if (-not $driverId -and $drvProfile.driver) { $driverId = $drvProfile.driver.id }
if (-not $driverId -and $drvProfile.data)   { $driverId = $drvProfile.data.id }
if ($driverId) { Ok "demo driver driver_id=$driverId" } else { Bad 'could not resolve demo driver id'; Write-Host ($drvProfile | ConvertTo-Json -Depth 4) }

# ── 1. Client / Master Data ──
Step '1. Customer / Client data + Master Data options'
$opts = Invoke-RestMethod -Uri "$base/dispatch/master-data/options" -Headers (Hdr $tDisp)
if ($opts.clients.Count -gt 0)        { Ok "clients available ($($opts.clients.Count))" } else { Bad 'no clients in master data' }
if ($opts.material_types.Count -gt 0) { Ok "material types available ($($opts.material_types.Count))" } else { Bad 'no material types' }
if ($opts.quarries.Count -gt 0)       { Ok "quarries available ($($opts.quarries.Count))" } else { Bad 'no quarries' }
$client = $opts.clients | Where-Object { $_.client_name -like '*San Miguel*' } | Select-Object -First 1
if (-not $client) { $client = $opts.clients | Select-Object -First 1 }
$mt = $opts.material_types | Select-Object -First 1
$spec = $mt.specifications | Select-Object -First 1
Ok "selected client=$($client.client_name) material=$($mt.name)/$($spec.name)"

# ── 2. Job Order creation ──
Step '2. Job Order creation (existing client)'
$joBody = @{
  client_mode = 'existing'; client_id = $client.id
  material_type_id = $mt.id; material_specification_id = $spec.id
  load_volume_m3 = 12; scheduled_start = (Get-Date).AddDays(1).ToString('yyyy-MM-ddTHH:mm')
  scheduled_end = (Get-Date).AddDays(1).AddHours(4).ToString('yyyy-MM-ddTHH:mm')
  priority = 'high'; special_handling_instructions = 'Handle with care'; notes = 'E2E test job'
  dropoff_province = 'Metro Manila'; dropoff_city = 'Makati'; dropoff_street = 'Ayala Ave Site'
} | ConvertTo-Json
$jo = Invoke-RestMethod -Uri "$base/dispatch/job-orders" -Method POST -ContentType 'application/json' -Headers (Hdr $tDisp) -Body $joBody
$jobId = $jo.id
if ($jobId) { Ok "job order created id=$jobId" } else { Bad 'job order not created' }
if ($jo.status -eq 'pending') { Ok 'status = pending' } else { Bad "status expected pending, got $($jo.status)" }
if ($jo.tracking_code) { Ok "tracking_code = $($jo.tracking_code)" } else { Bad 'no tracking code generated' }
if ($jo.quarry.quarry_name) { Ok "quarry auto-filled = $($jo.quarry.quarry_name)" } else { Bad 'quarry not auto-filled' }
$tracking = $jo.tracking_code

# ── 3. Best-Fit ──
Step '3. Best-Fit recommendation'
$bf = Invoke-RestMethod -Uri "$base/dispatch/best-fit/$jobId" -Headers (Hdr $tDisp)
if ($bf.recommendations.Count -gt 0) { Ok "recommendations returned ($($bf.recommendations.Count))" } else { Bad 'no recommendations' }
$top = $bf.recommendations[0]
if ($top.reasons.Count -gt 0) { Ok "top recommendation has reasons ($($top.reasons.Count))" } else { Bad 'no reasons on recommendation' }
if ($top.vehicle_cbm_capacity) { Ok "capacity matching present (cbm=$($top.vehicle_cbm_capacity), load=$($top.load_volume))" } else { Bad 'no capacity data' }
$vehicleId = $top.vehicle_id
Ok "top vehicle_id=$vehicleId type=$($top.vehicle_type)"

# ── 4. Dispatcher assignment (assign demo driver so PWA can be tested) ──
Step '4. Dispatcher assignment confirmation'
$asgBody = @{ job_order_id = $jobId; driver_id = $driverId; vehicle_id = $vehicleId } | ConvertTo-Json
try {
  $asg = Invoke-RestMethod -Uri "$base/dispatch/assignments" -Method POST -ContentType 'application/json' -Headers (Hdr $tDisp) -Body $asgBody
  $asgId = $asg.id
  if ($asgId) { Ok "assignment created id=$asgId status=$($asg.status)" } else { Bad 'assignment not created' }
} catch {
  Bad "assignment failed: $((New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())).ReadToEnd())"
}
$joAfter = Invoke-RestMethod -Uri "$base/dispatch/job-orders/$jobId" -Headers (Hdr $tDisp)
if ($joAfter.status -eq 'assigned') { Ok 'job order status = assigned' } else { Bad "job status expected assigned, got $($joAfter.status)" }

# duplicate-assignment guard
try {
  Invoke-RestMethod -Uri "$base/dispatch/assignments" -Method POST -ContentType 'application/json' -Headers (Hdr $tDisp) -Body $asgBody | Out-Null
  Bad 'duplicate assignment was allowed'
} catch { Ok 'duplicate assignment correctly rejected' }

# ── 5. Driver PWA reception ──
Step '5. Driver PWA task reception'
$drvJobs = Invoke-RestMethod -Uri "$base/driver/assignments" -Headers (Hdr $tDrv)
$mine = $drvJobs.data | Where-Object { $_.id -eq $asgId }
if ($mine) { Ok 'assignment visible in driver PWA' } else { Bad 'assignment NOT visible to driver' }
$drvDetail = Invoke-RestMethod -Uri "$base/driver/assignments/$asgId" -Headers (Hdr $tDrv)
if ($drvDetail.job_order.tracking_code -eq $tracking) { Ok 'driver sees job details + tracking code' } else { Bad 'driver job details missing' }

# ── 6. Driver status updates ──
Step '6. Driver status updates (en route)'
$stBody = @{ assignment_id = $asgId; status = 'en_route'; latitude = 14.55; longitude = 121.02 } | ConvertTo-Json
$st = Invoke-RestMethod -Uri "$base/driver/status" -Method POST -ContentType 'application/json' -Headers (Hdr $tDrv) -Body $stBody
if ($st.status -eq 'in_progress') { Ok "status updated to in_progress (en route)" } else { Bad "status update failed: $($st.status)" }

# ── 7. Customer tracking reflects en route ──
Step '7. Customer tracking (mid-delivery)'
$trk = Invoke-RestMethod -Uri "$base/customer/track/$tracking"
if ($trk.status -eq 'in_progress') { Ok "public tracking shows in_progress" } else { Bad "tracking status = $($trk.status)" }
if ($trk.timeline.Count -gt 0) { Ok "tracking timeline present ($($trk.timeline.Count) entries)" } else { Bad 'no tracking timeline' }
if ($trk.approximate_location) { Ok 'latest GPS location present' } else { Bad 'no GPS location on tracking' }

# ── 8. OCR document upload (driver) ──
Step '8. OCR document upload'
$imgB64 = '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AfwD/2Q=='
$imgPath = Join-Path $env:TEMP 'e2e_pod.jpg'
[System.IO.File]::WriteAllBytes($imgPath, [System.Convert]::FromBase64String($imgB64))
$uploadJson = & curl.exe -s -X POST "$base/driver/documents" -H "Authorization: Bearer $tDrv" -H "Accept: application/json" -F "assignment_id=$asgId" -F "type=pod" -F "file=@$imgPath"
try {
  $upload = $uploadJson | ConvertFrom-Json
  if ($upload.document.id) { Ok "document uploaded id=$($upload.document.id)" } else { Bad "upload failed: $uploadJson" }
  if ($upload.ocr_result) { Ok "OCR result created status=$($upload.ocr_result.processing_status)" } else { Bad 'no OCR result created' }
  $ocrId = $upload.ocr_result.id
} catch { Bad "upload response not JSON: $uploadJson" }

# ── 9. Admin OCR validation ──
Step '9. Admin OCR validation'
$review = Invoke-RestMethod -Uri "$base/admin/ocr/review" -Headers (Hdr $tAdmin)
$found = $review.data | Where-Object { $_.id -eq $ocrId }
if ($found) { Ok 'uploaded OCR doc visible in admin review' } else { Bad 'OCR doc not in admin review list' }
$valBody = @{ action = 'approve'; corrected_text = 'PoD confirmed by E2E'; confidence_score = 0.95 } | ConvertTo-Json
$val = Invoke-RestMethod -Uri "$base/admin/ocr/$ocrId/validate" -Method PUT -ContentType 'application/json' -Headers (Hdr $tAdmin) -Body $valBody
if ($val.is_validated -eq $true -and $val.processing_status -eq 'validated') { Ok 'OCR validated (PoD finalized)' } else { Bad "OCR validate failed: status=$($val.processing_status)" }

# ── 10. Driver completes delivery ──
Step '10. Driver completes delivery'
$arr = Invoke-RestMethod -Uri "$base/driver/status" -Method POST -ContentType 'application/json' -Headers (Hdr $tDrv) -Body (@{ assignment_id = $asgId; status = 'arrived' } | ConvertTo-Json)
if ($arr.status -eq 'arrived') { Ok 'status -> arrived' } else { Bad "arrived failed: $($arr.status)" }
$cmp = Invoke-RestMethod -Uri "$base/driver/status" -Method POST -ContentType 'application/json' -Headers (Hdr $tDrv) -Body (@{ assignment_id = $asgId; status = 'completed' } | ConvertTo-Json)
if ($cmp.status -eq 'completed') { Ok 'status -> completed' } else { Bad "complete failed: $($cmp.status)" }

# ── 11. Customer tracking shows completed + PoD ──
Step '11. Customer tracking (completed)'
$trk2 = Invoke-RestMethod -Uri "$base/customer/track/$tracking"
if ($trk2.status -eq 'completed') { Ok 'tracking shows completed' } else { Bad "tracking status = $($trk2.status)" }
if ($trk2.proof_documents.Count -gt 0) { Ok "PoD available on tracking ($($trk2.proof_documents.Count))" } else { Bad 'no PoD on completed tracking' }

# invalid tracking code
try { Invoke-RestMethod -Uri "$base/customer/track/INVALIDXYZ" | Out-Null; Bad 'invalid tracking code did not 404' }
catch { Ok 'invalid tracking code returns error/empty state' }

# ── 12. Manager analytics ──
Step '12. Manager analytics'
$dash = Invoke-RestMethod -Uri "$base/manager/dashboard" -Headers (Hdr $tMgr)
$an = Invoke-RestMethod -Uri "$base/manager/analytics" -Headers (Hdr $tMgr)
if ($dash.job_orders -gt 0) { Ok "dashboard total job_orders=$($dash.job_orders)" } else { Bad 'dashboard job_orders=0' }
if ($dash.jobs_completed -gt 0) { Ok "dashboard jobs_completed=$($dash.jobs_completed)" } else { Bad 'dashboard jobs_completed=0' }
if ($null -ne $dash.on_time_pct) { Ok "dashboard on_time_pct=$($dash.on_time_pct)%" } else { Bad 'dashboard on_time_pct is null' }
if ($null -ne $dash.delivery_completion_pct) { Ok "dashboard delivery_completion_pct=$($dash.delivery_completion_pct)%" } else { Bad 'dashboard delivery_completion_pct is null' }
if ($null -ne $dash.avg_delivery_time_hours) { Ok "dashboard avg_delivery_time_hours=$($dash.avg_delivery_time_hours)" } else { Bad 'dashboard avg_delivery_time_hours is null' }
try {
  $ocrMgr = Invoke-RestMethod -Uri "$base/ocr/review" -Headers (Hdr $tMgr)
  Ok 'manager can read OCR review queue'
} catch { Bad 'manager blocked from OCR review queue' }
if ($an.summary.completed -ge 1) { Ok "analytics summary.completed=$($an.summary.completed)" } else { Bad 'analytics completed not counted' }
if ($an.fleet.total -gt 0) { Ok "analytics fleet.total=$($an.fleet.total) utilization=$($an.fleet.utilization_pct)%" } else { Bad 'analytics fleet empty' }

# ── 13. Role access guard ──
Step '13. Role access guard'
try { Invoke-RestMethod -Uri "$base/manager/dashboard" -Headers (Hdr $tDrv) | Out-Null; Bad 'driver accessed manager dashboard' }
catch { Ok 'driver blocked from manager dashboard' }
try { Invoke-RestMethod -Uri "$base/admin/ocr/review" -Headers (Hdr $tDisp) | Out-Null; Bad 'dispatcher accessed admin OCR review' }
catch { Ok 'dispatcher blocked from admin OCR review' }

Write-Host ""
Write-Host "=============================================" -ForegroundColor Yellow
Write-Host " E2E RESULT:  PASS=$pass  FAIL=$fail" -ForegroundColor Yellow
Write-Host " Test job order id=$jobId  tracking=$tracking" -ForegroundColor Yellow
Write-Host "=============================================" -ForegroundColor Yellow

