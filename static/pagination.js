document.addEventListener('DOMContentLoaded', function() {
    const slidesList = document.getElementById('slides-list');
    const ul = slidesList.querySelector('ul');
    const items = Array.from(ul.children);
    const itemsPerPage = 10;
    let currentPage = 1;

    function showPage(page) {
        const start = (page - 1) * itemsPerPage;
        const end = start + itemsPerPage;

        items.forEach((item, index) => {
            item.style.display = (index >= start && index < end) ? 'block' : 'none';
        });

        updatePagination(page);
    }

    function updatePagination(page) {
        const totalPages = Math.ceil(items.length / itemsPerPage);

        // 기존 페이지네이션 제거
        const existingPagination = document.querySelector('.pagination');
        if (existingPagination) {
            existingPagination.remove();
        }

        if (totalPages <= 1) return;

        // 페이지네이션 컨테이너 생성
        const pagination = document.createElement('div');
        pagination.className = 'pagination';
        pagination.style.textAlign = 'center';
        pagination.style.marginTop = '2rem';

        // 이전 버튼
        if (page > 1) {
            const prevBtn = document.createElement('button');
            prevBtn.textContent = '이전';
            prevBtn.onclick = () => showPage(page - 1);
            prevBtn.style.margin = '0 0.5rem';
            prevBtn.style.padding = '0.5rem 1rem';
            prevBtn.style.border = 'none';
            prevBtn.style.background = 'rgba(45, 55, 72, 0.8)';
            prevBtn.style.color = '#e2e8f0';
            prevBtn.style.borderRadius = '5px';
            prevBtn.style.cursor = 'pointer';
            pagination.appendChild(prevBtn);
        }

        // 페이지 번호
        for (let i = 1; i <= totalPages; i++) {
            const pageBtn = document.createElement('button');
            pageBtn.textContent = i;
            pageBtn.onclick = () => showPage(i);
            pageBtn.style.margin = '0 0.2rem';
            pageBtn.style.padding = '0.5rem 0.8rem';
            pageBtn.style.border = 'none';
            pageBtn.style.borderRadius = '5px';
            pageBtn.style.cursor = 'pointer';
            if (i === page) {
                pageBtn.style.background = 'rgba(26, 32, 44, 0.9)';
                pageBtn.style.color = '#cbd5e0';
                pageBtn.style.fontWeight = 'bold';
            } else {
                pageBtn.style.background = 'rgba(45, 55, 72, 0.8)';
            pageBtn.style.color = '#e2e8f0';
            }
            pagination.appendChild(pageBtn);
        }

        // 다음 버튼
        if (page < totalPages) {
            const nextBtn = document.createElement('button');
            nextBtn.textContent = '다음';
            nextBtn.onclick = () => showPage(page + 1);
            nextBtn.style.margin = '0 0.5rem';
            nextBtn.style.padding = '0.5rem 1rem';
            nextBtn.style.border = 'none';
            nextBtn.style.background = 'rgba(45, 55, 72, 0.8)';
            nextBtn.style.color = '#e2e8f0';
            nextBtn.style.borderRadius = '5px';
            nextBtn.style.cursor = 'pointer';
            pagination.appendChild(nextBtn);
        }

        slidesList.appendChild(pagination);
    }

    // 초기 페이지 표시
    showPage(currentPage);
});
