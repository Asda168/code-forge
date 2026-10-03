(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const root = 'C:/Users/oukas/AppData/Local/Temp/proj'; await CF.setRoot(root); await sleep(800);
  await cf.fs.write(root + '/a.php', "<?php\n// VS Code style theme\nnamespace App;\n\nclass User extends Model\n{\n    public function posts(): array\n    {\n        $name = \"CodeForge\";\n        return [1, 2, 3];\n    }\n}\n");
  await CF.openFile(root + '/a.php'); await CF.setSetting({ theme: 'vsc-dark-modern' }); await sleep(900);
  return 'ok';
})()
