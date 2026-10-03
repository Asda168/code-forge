; Extra NSIS steps: "Open with CodeForge" context menu + add to PATH (per-user).
!macro customInstall
  WriteRegStr HKCU "Software\Classes\*\shell\CodeForge" "" "Open with CodeForge"
  WriteRegStr HKCU "Software\Classes\*\shell\CodeForge" "Icon" "$INSTDIR\CodeForge.exe"
  WriteRegStr HKCU "Software\Classes\*\shell\CodeForge\command" "" '"$INSTDIR\CodeForge.exe" "%1"'
  WriteRegStr HKCU "Software\Classes\Directory\shell\CodeForge" "" "Open with CodeForge"
  WriteRegStr HKCU "Software\Classes\Directory\shell\CodeForge" "Icon" "$INSTDIR\CodeForge.exe"
  WriteRegStr HKCU "Software\Classes\Directory\shell\CodeForge\command" "" '"$INSTDIR\CodeForge.exe" "%V"'
  ; PATH: append install dir for current user (simple form; does not dedupe).
  ReadRegStr $0 HKCU "Environment" "Path"
  StrCmp $0 "" +2
    WriteRegExpandStr HKCU "Environment" "Path" "$0;$INSTDIR"
  StrCmp $0 "" 0 +2
    WriteRegExpandStr HKCU "Environment" "Path" "$INSTDIR"
  SendMessage ${HWND_BROADCAST} ${WM_WININICHANGE} 0 "STR:Environment" /TIMEOUT=5000
!macroend

!macro customUnInstall
  DeleteRegKey HKCU "Software\Classes\*\shell\CodeForge"
  DeleteRegKey HKCU "Software\Classes\Directory\shell\CodeForge"
!macroend
