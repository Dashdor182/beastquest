// CSV parsing + validation + normalization
export function detectDelimiter(text){
    const sample = text.slice(0, 10000);
    const lines = sample.split(/\r\n|\n|\r/).slice(0, 10);
    const cands = [',',';','\t','|'];
    let best = ',', bestScore = -1;
    for (const cand of cands){
      let score = 0;
      for (const line of lines){
        let inQ = false, cnt = 0;
        for (let i=0;i<line.length;i++){
          const ch = line[i];
          if (ch === '"'){
            if (inQ && line[i+1] === '"'){ i++; continue; }
            inQ = !inQ;
          } else if (!inQ && ch === cand){ cnt++; }
        }
        score += cnt;
      }
      if (score > bestScore){ bestScore = score; best = cand; }
    }
    return best;
  }
  
  export function parseCSV(text, delimiter=','){
    text = text.replace(/^\uFEFF/, ''); // BOM
    const rows = [];
    let row = [], field = '', inQ = false;
    for (let i=0;i<text.length;i++){
      const ch = text[i];
      if (inQ){
        if (ch === '"'){
          if (text[i+1] === '"'){ field += '"'; i++; }
          else { inQ = false; }
        } else { field += ch; }
      } else {
        if (ch === '"'){ inQ = true; }
        else if (ch === delimiter){ row.push(field); field = ''; }
        else if (ch === '\n'){ row.push(field); rows.push(row); row = []; field = ''; }
        else if (ch === '\r'){ if (text[i+1] === '\n'){ i++; } row.push(field); rows.push(row); row = []; field = ''; }
        else { field += ch; }
      }
    }
    if (field.length || row.length){ row.push(field); rows.push(row); }
    return rows;
  }
  
  export function csvToBooks(text){
    const delim = detectDelimiter(text);
    const rows = parseCSV(text, delim);
    if (!rows.length) throw new Error('CSV is empty');
    const headerRaw = rows.shift();
    const headerLen = headerRaw.length;
    if (!headerLen) throw new Error('Header row is empty');
  
    // 1) Row width must match header width exactly
    rows.forEach((r, i) => {
      if (r.length !== headerLen) throw new Error(`Row ${i+2} has ${r.length} columns; expected ${headerLen}`);
    });
  
    // 2) Validate header names
    const norm = (h)=> String(h||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'');
    const headers = headerRaw.map(norm);
    const allowed = new Set([
      'id','bookid',
      'title','name',
      'number','no','booknumber','bookno','num',
      'saga',
      'series',
      'seriesindex','series_idx','seriesnumber','seriesno','seriesnum','idx'
    ]);
    for (const h of headers){ if (!allowed.has(h)) throw new Error(`Unknown column: "${h}"`); }
  
    // 3) Required columns
    const find = (names)=>{ for(const n of names){ const i = headers.indexOf(n); if(i!==-1) return i; } return -1; };
    const idxId     = find(['id','bookid']);
    const idxTitle  = find(['title','name']);
    if (idxId === -1 || idxTitle === -1) throw new Error('CSV must include columns: id, title');
  
    // Optional columns
    const idxNum    = find(['number','no','booknumber','bookno','num']);
    const idxSaga   = find(['saga']);
    const idxSeries = find(['series']);
    const idxSIdx   = find(['seriesindex','series_idx','seriesnumber','seriesno','seriesnum','idx']);
  
    const out = [];
    rows.forEach((row, i) => {
      const g = (ix)=> (ix>=0 && ix<row.length) ? String(row[ix]).trim() : '';
      const id    = g(idxId);
      const title = g(idxTitle);
      if (!id) throw new Error(`Row ${i+2} has empty id`);
      if (!title) throw new Error(`Row ${i+2} has empty title`);
      const saga  = g(idxSaga);
      const series= g(idxSeries);
      const nStr  = g(idxNum);
      const siStr = g(idxSIdx);
      const number = nStr === '' ? undefined : Number(nStr);
      const seriesIndex = siStr !== '' ? Number(siStr) : (Number(nStr) || undefined);
      out.push({
        id,
        number: Number.isFinite(number) ? number : undefined,
        title,
        saga,
        series,
        seriesIndex: Number.isFinite(seriesIndex) ? seriesIndex : undefined,
      });
    });
    return out;
  }
  
  // --- tiny console tests (unchanged) ---
  (function runCSVTests(){
    try{
      let pass=0; const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
      const r1 = parseCSV(`id,title,number\r\nS01-01,"Hello, World",1\r\n`, ',');
      console.assert(eq(r1, [["id","title","number"],["S01-01","Hello, World","1"]]), 'CSV t1'); pass++;
      const r2 = parseCSV(`id;title;seriesIndex\nA;B;3\n`, ';');
      console.assert(eq(r2, [["id","title","seriesIndex"],["A","B","3"]]), 'CSV t2'); pass++;
      const r3 = parseCSV(`id\ttitle\nX\t"Y\tZ"\n`, '\t');
      console.assert(eq(r3, [["id","title"],["X","Y\tZ"]]), 'CSV t3'); pass++;
      const r4 = parseCSV(`a|b|c\n1|2|3`, '|');
      console.assert(eq(r4, [["a","b","c"],["1","2","3"]]), 'CSV t4'); pass++;
      const r5 = parseCSV(`id,title\n1,"He said ""Hi"""`, ',');
      console.assert(eq(r5, [["id","title"],["1","He said \"Hi\""]]), 'CSV t5'); pass++;
      const r6 = parseCSV(`\uFEFFid,title\n1,Ok`, ',');
      console.assert(eq(r6, [["id","title"],["1","Ok"]]), 'CSV t6'); pass++;
      try{ csvToBooks(`id,title\nA`); console.assert(false, 't7 should throw'); } catch(_) { pass++; }
      try{ csvToBooks(`id,title\nA,Name,Extra`); console.assert(false, 't8 should throw'); } catch(_) { pass++; }
      try{ csvToBooks(`id,title,unknown\nA,Name,X`); console.assert(false, 't9 should throw'); } catch(_) { pass++; }
      try{ csvToBooks(`id,title\n,Name`); console.assert(false, 't10a'); } catch(_) { pass++; }
      try{ csvToBooks(`id,title\nA,`); console.assert(false, 't10b'); } catch(_) { pass++; }
      const d1 = detectDelimiter(`a,b,c\n1,2,3`); console.assert(d1 === ',', 'delim ,'); pass++;
      const d2 = detectDelimiter(`a;b;c\n1;2;3`); console.assert(d2 === ';', 'delim ;'); pass++;
      const d3 = detectDelimiter(`a\tb\tc\n1\t2\t3`); console.assert(d3 === '\t', 'delim \\t'); pass++;
      console.info(`CSV tests passed: ${pass}`);
    }catch(e){ console.warn('CSV tests encountered an error (non-fatal):', e); }
  })();
  