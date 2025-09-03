const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');

const articlesDir = path.join(__dirname, 'articles');
const staticArticlesDir = path.join(__dirname, 'static', 'articles');
const indexHtmlPath = path.join(__dirname, 'static', 'index.html');

// static/articles 폴더가 없으면 생성
if (!fs.existsSync(staticArticlesDir)) {
  fs.mkdirSync(staticArticlesDir, { recursive: true });
}

// articles 폴더의 서브폴더 리스트 가져오기
const projects = fs.readdirSync(articlesDir).filter(item => {
  const itemPath = path.join(articlesDir, item);
  return fs.statSync(itemPath).isDirectory();
});

// 프로젝트 파싱 및 정렬
const parsedProjects = projects.map(project => {
  const parts = project.split('_');
  if (parts.length >= 2) {
    const dateStr = parts[0];
    const name = parts.slice(1).join('_');
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    const date = new Date(`${year}-${month}-${day}`);
    return { project, date, name, dateStr };
  }
  return null;
}).filter(p => p !== null);

// 날짜 내림차순, 날짜 같으면 이름 알파벳 순 정렬
parsedProjects.sort((a, b) => {
  if (a.date.getTime() !== b.date.getTime()) {
    return b.date - a.date; // 최신이 위로
  }
  return a.name.localeCompare(b.name);
});

parsedProjects.forEach(({ project, date, name, dateStr }) => {
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

// 슬라이드 목록 HTML 생성 (항상 실행)
const slidesListHtml = parsedProjects.map(({ project, date, name, dateStr }) => {
  const year = dateStr.substring(0, 4);
  const month = dateStr.substring(4, 6);
  const day = dateStr.substring(6, 8);
  const formattedDate = `${year}-${month}-${day}`;
  const displayName = name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()); // 이름 포맷팅

  // 썸네일 이미지 경로
  const thumbnailPath = `./articles/${project}/og-image.png`;
  const thumbnailHtml = fs.existsSync(path.join(staticArticlesDir, project, 'og-image.png')) 
    ? `<img src="${thumbnailPath}" alt="${displayName} 썸네일" class="thumbnail">` 
    : '';

  return `                <li>
                    <a href="./articles/${project}/index.html" target="_blank">
                        ${thumbnailHtml}
                        <h3>${formattedDate} ${displayName}</h3>
                    </a>
                </li>`;
}).join('\n');

// index.html 업데이트
let indexContent = fs.readFileSync(indexHtmlPath, 'utf-8');
indexContent = indexContent.replace(/(<ul>[\s\S]*?<\/ul>)/, `<ul>\n${slidesListHtml}\n            </ul>`);
fs.writeFileSync(indexHtmlPath, indexContent);

console.log('Build process completed.');
