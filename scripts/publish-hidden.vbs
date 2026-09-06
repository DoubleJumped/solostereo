' Publish invisibly and propagate the result to Windows Task Scheduler.
Option Explicit
Dim fso, sh, root, result
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
root = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))
sh.CurrentDirectory = root
result = sh.Run("cmd /c npm run publish:demo >> ""data\publish.log"" 2>&1", 0, True)
WScript.Quit result
