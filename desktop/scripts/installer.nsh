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
