# Run as the signed-in archive owner. Existing sync settings/principal are preserved.
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$syncTask = Get-ScheduledTask -TaskName 'solostereo-sync'
$syncTask.Triggers[0].Repetition.Interval = 'PT2H'
Set-ScheduledTask -TaskName 'solostereo-sync' -Trigger $syncTask.Triggers | Out-Null

$publicationAction = New-ScheduledTaskAction -Execute 'wscript.exe' -Argument ('"' + (Join-Path $PSScriptRoot 'publish-hidden.vbs') + '"') -WorkingDirectory $projectRoot
$publicationTriggers = @(
  (New-ScheduledTaskTrigger -Daily -At '12:45PM'),
  (New-ScheduledTaskTrigger -Daily -At '8:45PM')
)
$publicationSettings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 30) -RestartCount 2 -RestartInterval (New-TimeSpan -Minutes 15)
$publicationPrincipal = New-ScheduledTaskPrincipal -UserId $syncTask.Principal.UserId -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName 'solostereo-publish' -Action $publicationAction -Trigger $publicationTriggers -Settings $publicationSettings -Principal $publicationPrincipal -Description 'Publish the sanitized Solo Stereo listening archive at 12:45 PM and 8:45 PM; catch up when this computer is available.' -Force | Out-Null

foreach ($taskName in @('solostereo-sync', 'solostereo-publish')) {
  $task = Get-ScheduledTask -TaskName $taskName
  $info = Get-ScheduledTaskInfo -TaskName $taskName
  [pscustomobject]@{ Name=$taskName; Interval=($task.Triggers | ForEach-Object {$_.Repetition.Interval}) -join ','; Starts=($task.Triggers | ForEach-Object {$_.StartBoundary}) -join ', '; NextRun=$info.NextRunTime; CatchUp=$task.Settings.StartWhenAvailable; User=$task.Principal.UserId }
}
