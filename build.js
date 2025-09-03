const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');

const articlesDir = path.join(__dirname, 'articles');
const staticArticlesDir = path.join(__dirname, 'static', 'articles');

// static/articles 폴더가 없으면 생성
if (!fs.existsSync(staticArticlesDir)) {
  fs.mkdirSync(staticArticlesDir, { recursive: true });
}

// articles 폴더의 서브폴더 리스트 가져오기
const projects = fs.readdirSync(articlesDir).filter(item => {
  const itemPath = path.join(articlesDir, item);
  return fs.statSync(itemPath).isDirectory();
});

projects.forEach(project => {
  const projectDir = path.join(articlesDir, project);
  const outputDir = path.join(staticArticlesDir, project);
  const distDir = path.join(projectDir, 'dist');

  // static/articles/{project}가 없으면 빌드
  if (!fs.existsSync(outputDir)) {
    console.log(`Building ${project}...`);
    try {
      // slidev.config.js 생성
      const configPath = path.join(projectDir, 'slidev.config.js');
      const configContent = `export default {\n  base: '/articles/${project}/'\n}`;
      fs.writeFileSync(configPath, configContent);

      // 프로젝트 폴더로 이동해서 빌드 (base 옵션으로)
      execSync(`pnpm build --base /articles/${project}/`, { cwd: projectDir, stdio: 'inherit' });

      // dist를 static/articles/{project}로 복사
      if (fs.existsSync(distDir)) {
        fs.copySync(distDir, outputDir);
        console.log(`Copied ${project} to ${outputDir}`);
      } else {
        console.error(`dist folder not found for ${project}`);
      }
    } catch (error) {
      console.error(`Failed to build ${project}:`, error.message);
    }
  } else {
    console.log(`${project} already exists in static/articles`);
  }
});

console.log('Build process completed.');
