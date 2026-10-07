; Close a running CodeCambo before installing/upgrading. Graceful first (WM_CLOSE to CodeCambo.exe and its child tree,
; so the app can save/kill its terminals), wait up to ~10s, then force-kill ONLY the CodeCambo.exe process tree (/t) -
; this also removes node-pty's conpty/OpenConsole helpers that would otherwise lock files in the install folder.
; Never touches other node/powershell/cmd/electron processes.
!macro customCheckAppRunning
  nsExec::Exec 'taskkill /t /im CodeCambo.exe'
  Pop $0
  StrCpy $1 0
  cf_wait:
    nsExec::Exec 'cmd /c tasklist /fi "imagename eq CodeCambo.exe" /nh | find /i "CodeCambo.exe"'
    Pop $0
    StrCmp $0 0 0 cf_closed
    IntOp $1 $1 + 1
    IntCmp $1 20 cf_force 0 0
    Sleep 500
    Goto cf_wait
  cf_force:
    nsExec::Exec 'taskkill /f /t /im CodeCambo.exe'
    Pop $0
    Sleep 1000
  cf_closed:
!macroend

; Extra NSIS steps: "Open with CodeCambo" context menu + add to PATH (per-user).
!macro customInstall
  WriteRegStr HKCU "Software\Classes\*\shell\CodeCambo" "" "Open with CodeCambo"
  WriteRegStr HKCU "Software\Classes\*\shell\CodeCambo" "Icon" "$INSTDIR\CodeCambo.exe"
  WriteRegStr HKCU "Software\Classes\*\shell\CodeCambo\command" "" '"$INSTDIR\CodeCambo.exe" "%1"'
  WriteRegStr HKCU "Software\Classes\Directory\shell\CodeCambo" "" "Open with CodeCambo"
  WriteRegStr HKCU "Software\Classes\Directory\shell\CodeCambo" "Icon" "$INSTDIR\CodeCambo.exe"
  WriteRegStr HKCU "Software\Classes\Directory\shell\CodeCambo\command" "" '"$INSTDIR\CodeCambo.exe" "%V"'
  ; PATH: append install dir for current user (simple form; does not dedupe).
  ReadRegStr $0 HKCU "Environment" "Path"
  StrCmp $0 "" +2
    WriteRegExpandStr HKCU "Environment" "Path" "$0;$INSTDIR"
  StrCmp $0 "" 0 +2
    WriteRegExpandStr HKCU "Environment" "Path" "$INSTDIR"
  SendMessage ${HWND_BROADCAST} ${WM_WININICHANGE} 0 "STR:Environment" /TIMEOUT=5000
!macroend

!macro customUnInstall
  DeleteRegKey HKCU "Software\Classes\*\shell\CodeCambo"
  DeleteRegKey HKCU "Software\Classes\Directory\shell\CodeCambo"
!macroend
