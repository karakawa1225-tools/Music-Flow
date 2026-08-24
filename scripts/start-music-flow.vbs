Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
projectDir = fso.GetParentFolderName(scriptDir)

' Avoid multiple MUSIC FLOW / Electron instances fighting over the same data
shell.Run "cmd /c taskkill /F /IM electron.exe >nul 2>&1", 0, True

shell.CurrentDirectory = projectDir
shell.Run "cmd /c npm run dev", 0, False
