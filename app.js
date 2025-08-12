//// filepath: /srv/www/htdocs/group/avic5/app.js
(async function(){
  // 1) Fetch the manifest
  const manifest = await fetch('./manifest.json').then(r => r.json());

  // 2) Get references to DOM elements
  const singleRunHeading = document.getElementById('singleRunHeading');
  const runSelect        = document.getElementById('runSelect');
  const convSelect       = document.getElementById('convSelect');
  const varSelect        = document.getElementById('varSelect');
  const elevSelect       = document.getElementById('elevSelect');
  const timeRange        = document.getElementById('timeRange');
  const timeLabel        = document.getElementById('timeLabel');
  const plot             = document.getElementById('plot');
  const loadBtn          = document.getElementById('loadBtn');
  const gridCount        = document.getElementById('gridCount');
  const compareBtn       = document.getElementById('compareBtn');
  const comparisonDiv    = document.getElementById('comparisonGrid');
  // New container that holds the run selects for comparison
  const gridSelectContainer = document.getElementById('gridSelectContainer');

  // -----------------------
  // Populate the single-run dropdown
  // -----------------------
  Object.keys(manifest.runs).forEach(run => {
    const opt = document.createElement('option');
    opt.value = run;
    opt.textContent = `Run ${run}`;
    runSelect.appendChild(opt);
  });
  runSelect.value = Object.keys(manifest.runs)[0] || '';

  // -----------------------
  // Re-populate Elevations when run/conv/var changes
  // -----------------------
  function repopulateElevations() {
    elevSelect.innerHTML = '';
    plot.src = '';
    const runVal  = runSelect.value;
    const convVal = convSelect.value;
    const varVal  = varSelect.value;

    const varData = manifest.runs[runVal]?.[varVal];
    if (!varData) return;

    // Sort z-keys so "000" appears first, then ascending numeric order
    const zVals = Object.keys(varData).sort((a, b) => {
      if (a === '000') return -1;
      if (b === '000') return 1;
      return parseInt(a, 10) - parseInt(b, 10);
    });

    zVals.forEach(zVal => {
      const subObj = varData[zVal];
      if (subObj[convVal]) {
        const opt = document.createElement('option');
        opt.value = zVal;
        opt.textContent = `z=${zVal}`;
        elevSelect.appendChild(opt);
      }
    });
  }
  runSelect.addEventListener('change', repopulateElevations);
  convSelect.addEventListener('change', repopulateElevations);
  varSelect.addEventListener('change', repopulateElevations);
  repopulateElevations();

  // -----------------------
  // Time label updates
  // -----------------------
  function updateTimeLabel() {
    const t = parseInt(timeRange.value, 10);
    const hours = (t - 1) * 24;
    timeLabel.textContent = `${hours} hrs`;
  }
  timeRange.addEventListener('input', updateTimeLabel);
  updateTimeLabel();

  // -------------------------
  // LOAD button => single image
  // -------------------------
  loadBtn.addEventListener('click', () => {
    const runVal  = runSelect.value;
    const convVal = convSelect.value;
    const varVal  = varSelect.value;
    const elevVal = elevSelect.value;
    const tIndex  = parseInt(timeRange.value, 10) - 1;

    // Set heading to “Run 124”, etc.
    singleRunHeading.textContent = `Run ${runVal}`;

    const arr = manifest.runs[runVal]?.[varVal]?.[elevVal]?.[convVal];
    if (!arr) {
      plot.src = '';
      plot.alt = 'No data for that combination.';
      return;
    }

    const path = arr[tIndex];
    if (path) {
      plot.src = path;
      plot.alt = `${runVal} / ${convVal} / ${varVal} / z=${elevVal} / t=${tIndex*24} hrs`;
    } else {
      plot.src = '';
      plot.alt = 'No image at this time index.';
    }
  });

  // -------------------------
  // Dynamically build run selects for multi-run comparison
  // -------------------------
  function updateComparisonSelects() {
    const allRunIDs = Object.keys(manifest.runs).sort((a, b) => parseInt(a) - parseInt(b));
    const N = parseInt(gridCount.value, 10) || 1;
    gridSelectContainer.innerHTML = '';

    for (let i = 0; i < N; i++) {
      const sel = document.createElement('select');
      sel.className = 'comparisonRunSelect';

      allRunIDs.forEach(rid => {
        const opt = document.createElement('option');
        opt.value = rid;
        opt.textContent = `Run ${rid}`;
        sel.appendChild(opt);
      });

      gridSelectContainer.appendChild(sel);
      gridSelectContainer.appendChild(document.createElement('br'));
    }
  }
  gridCount.addEventListener('input', updateComparisonSelects);
  updateComparisonSelects(); // initialize

  // -------------------------
  // Compare button => multiple columns
  // -------------------------
  compareBtn.addEventListener('click', () => {
    const convVal = convSelect.value;
    const varVal  = varSelect.value;
    const elevVal = elevSelect.value;
    const tIndex  = parseInt(timeRange.value, 10) - 1;

    comparisonDiv.innerHTML = '';

    // Gather chosen run IDs from the newly created <select> elements
    const selects = gridSelectContainer.querySelectorAll('select');
    const chosen  = Array.from(selects).map(sel => sel.value);

    chosen.forEach(rVal => {
      const arr   = manifest.runs[rVal]?.[varVal]?.[elevVal]?.[convVal];
      const colDiv = document.createElement('div');
      colDiv.style.textAlign = 'center';

      const heading = document.createElement('h3');
      heading.textContent = `Run ${rVal}`;
      colDiv.appendChild(heading);

      const imgEl  = document.createElement('img');
      imgEl.style.maxWidth = '200px';

      if (arr && arr[tIndex]) {
        imgEl.src = arr[tIndex];
        imgEl.alt = `Run ${rVal}, ${convVal}, ${varVal}, z=${elevVal}, t=${tIndex*24} hrs`;
        imgEl.addEventListener('click', () => {
          if (!imgEl.src) return;
          imageModal.style.display = 'block';
          modalImg.src = imgEl.src;
          resetZoom();
        });
      } else {
        imgEl.alt = 'No data found';
      }

      colDiv.appendChild(imgEl);
      comparisonDiv.appendChild(colDiv);
    });
  });

  // -------------------------
  // MODAL (zoom & pan)
  // -------------------------
  let scale   = 1;
  let originX = 0;
  let originY = 0;
  let isDragging  = false;
  let startMouseX = 0;
  let startMouseY = 0;

  plot.addEventListener('click', () => {
    if (!plot.src) return;
    imageModal.style.display = 'block';
    modalImg.src = plot.src;
    resetZoom();
  });

  modalClose.addEventListener('click', () => {
    imageModal.style.display = 'none';
    modalImg.src = '';
  });

  imageModal.addEventListener('click', (e) => {
    if (e.target === imageModal) {
      imageModal.style.display = 'none';
      modalImg.src = '';
    }
  });

  modalImg.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = -Math.sign(e.deltaY) * 0.1;
    scale = Math.min(5, Math.max(0.2, scale + delta));
    applyTransform();
  }, { passive: false });

  modalImg.addEventListener('mousedown', (e) => {
    e.preventDefault();
    isDragging  = true;
    startMouseX = e.clientX - originX;
    startMouseY = e.clientY - originY;
  });
  modalImg.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    originX = e.clientX - startMouseX;
    originY = e.clientY - startMouseY;
    applyTransform();
  });
  modalImg.addEventListener('mouseup', () => {
    isDragging = false;
  });
  modalImg.addEventListener('mouseleave', () => {
    isDragging = false;
  });

  function resetZoom() {
    scale   = 1;
    originX = 0;
    originY = 0;
    applyTransform();
  }
  function applyTransform() {
    modalImg.style.transform = `
      translate(-50%, -50%)
      translate(${originX}px, ${originY}px)
      scale(${scale})
    `;
  }
})();