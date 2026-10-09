; Close a running Asta before installing/upgrading. Graceful first (WM_CLOSE to Asta.exe and its child tree,
; so the app can save/kill its terminals), wait up to ~10s, then force-kill ONLY the Asta.exe process tree (/t) -
; this also removes node-pty's conpty/OpenConsole helpers that would otherwise lock files in the install folder.
; Never touches other node/powershell/cmd/electron processes.
!macro customCheckAppRunning
  nsExec::Exec 'taskkill /t /im Asta.exe'
  Pop $0
  StrCpy $1 0
  cf_wait:
    nsExec::Exec 'cmd /c tasklist /fi "imagename eq Asta.exe" /nh | find /i "Asta.exe"'
    Pop $0
    StrCmp $0 0 0 cf_closed
    IntOp $1 $1 + 1
    IntCmp $1 20 cf_force 0 0
    Sleep 500
    Goto cf_wait
  cf_force:
    nsExec::Exec 'taskkill /f /t /im Asta.exe'
    Pop $0
    Sleep 1000
  cf_closed:
!macroend

; Extra NSIS steps: "Open with Asta" context menu + add to PATH (per-user).
!macro customInstall
  WriteRegStr HKCU "Software\Classes\*\shell\Asta" "" "Open with Asta"
  WriteRegStr HKCU "Software\Classes\*\shell\Asta" "Icon" "$INSTDIR\Asta.exe"
  WriteRegStr HKCU "Software\Classes\*\shell\Asta\command" "" '"$INSTDIR\Asta.exe" "%1"'
  WriteRegStr HKCU "Software\Classes\Directory\shell\Asta" "" "Open with Asta"
  WriteRegStr HKCU "Software\Classes\Directory\shell\Asta" "Icon" "$INSTDIR\Asta.exe"
  WriteRegStr HKCU "Software\Classes\Directory\shell\Asta\command" "" '"$INSTDIR\Asta.exe" "%V"'
  ; PATH: append install dir for current user (simple form; does not dedupe).
  ReadRegStr $0 HKCU "Environment" "Path"
  StrCmp $0 "" +2
    WriteRegExpandStr HKCU "Environment" "Path" "$0;$INSTDIR"
  StrCmp $0 "" 0 +2
    WriteRegExpandStr HKCU "Environment" "Path" "$INSTDIR"
  SendMessage ${HWND_BROADCAST} ${WM_WININICHANGE} 0 "STR:Environment" /TIMEOUT=5000
  ; Shortcuts: point them at the bundled .ico explicitly so they never show the default/stale icon.
  SetOutPath "$INSTDIR"
  IfFileExists "$DESKTOP\Asta.lnk" 0 +2
    CreateShortCut "$DESKTOP\Asta.lnk" "$INSTDIR\Asta.exe" "" "$INSTDIR\resources\icon.ico" 0
  IfFileExists "$SMPROGRAMS\Asta.lnk" 0 +2
    CreateShortCut "$SMPROGRAMS\Asta.lnk" "$INSTDIR\Asta.exe" "" "$INSTDIR\resources\icon.ico" 0
  ; Refresh the Explorer icon cache (SHCNE_ASSOCCHANGED).
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend

!macro customUnInstall
  DeleteRegKey HKCU "Software\Classes\*\shell\Asta"
  DeleteRegKey HKCU "Software\Classes\Directory\shell\Asta"
!macroend
