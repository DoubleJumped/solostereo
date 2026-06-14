' solostereo hidden sync launcher (for Windows Task Scheduler).
' Runs "npm run sync" with NO visible window, so a scheduled run never pops a
' console or steals focus from a fullscreen app/game.
' The "0" window style = hidden and do-not-activate; "False" = don't wait.
Option Explicit
Dim fso, sh, root
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
root = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))
sh.CurrentDirectory = root
sh.Run "cmd /c npm run sync >> ""data\sync.log"" 2>&1", 0, False
