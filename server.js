const express = require('express');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// static 폴더를 루트로 서빙
app.use(express.static(path.join(__dirname, 'static')));

// 기본적으로 index.html 서빙
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'static', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
