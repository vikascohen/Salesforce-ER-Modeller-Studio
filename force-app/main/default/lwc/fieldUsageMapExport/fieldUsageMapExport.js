function widthFor(node) {
    if (node?.kind === 'component') return 250;
    if (node?.kind === 'usage') return 280;
    if (node?.kind === 'evidence' || node?.kind === 'evidence-more') return 210;
    return 190;
}

function wrap(ctx, text, maxWidth, maxLines = 4) {
    const words = String(text || '').split(/\s+/); const lines=[]; let line='';
    for (const word of words) {
        const next=line ? `${line} ${word}` : word;
        if (ctx.measureText(next).width > maxWidth && line) { lines.push(line); line=word; if(lines.length>=maxLines-1) break; }
        else line=next;
    }
    if(line && lines.length<maxLines) lines.push(line);
    return lines;
}

export function exportFieldUsageMapAsPng(map, title = 'Field Usage Dependency Map') {
    if (!map?.nodes?.length) return Promise.reject(new Error('Build a Field Usage map before exporting.'));
    const pad=64, header=92, scale=2;
    const width=Math.ceil((map.width||1320)+pad*2), height=Math.ceil((map.height||650)+pad*2+header);
    const canvas=document.createElement('canvas'); canvas.width=width*scale; canvas.height=height*scale;
    const ctx=canvas.getContext('2d'); ctx.scale(scale,scale); ctx.fillStyle='#1e1e1e'; ctx.fillRect(0,0,width,height);
    ctx.fillStyle='#e8e8e8'; ctx.font='700 24px Arial, sans-serif'; ctx.fillText(title,pad,42);
    ctx.fillStyle='#9aa0a6'; ctx.font='12px Arial, sans-serif'; ctx.fillText('ER Modeller Studio · persisted dependency evidence',pad,66);
    ctx.save(); ctx.translate(pad,pad+header);
    ctx.strokeStyle='#007acc'; ctx.lineWidth=1.5; ctx.globalAlpha=.75;
    (map.edges||[]).forEach(e=>{const nums=String(e.path||'').match(/-?\d+(?:\.\d+)?/g)?.map(Number)||[]; if(nums.length<4)return; ctx.beginPath(); let i=0; let x=nums[i++],y=nums[i++]; ctx.moveTo(x,y); const tokens=String(e.path).trim().split(/\s+/); let cx=x,cy=y,ni=2; for(let t=3;t<tokens.length;){const cmd=tokens[t++]; if(cmd==='H'){cx=Number(tokens[t++]);ctx.lineTo(cx,cy);}else if(cmd==='V'){cy=Number(tokens[t++]);ctx.lineTo(cx,cy);}else if(cmd==='L'){cx=Number(tokens[t++]);cy=Number(tokens[t++]);ctx.lineTo(cx,cy);}else{t++;}} ctx.stroke();});
    ctx.globalAlpha=1;
    (map.nodes||[]).forEach(n=>{const w=widthFor(n),h=n.kind==='usage'?78:68; let fill='#252526',stroke='#4a4a4a',titleColor='#e8e8e8',subColor='#a8a8a8'; if(n.kind==='object'){stroke='#007acc';} if(n.kind==='usage'){fill='#173d27';stroke='#45c96b';titleColor='#75e39b';subColor='#75d99a';} if(n.kind==='evidence-more'){fill='#202b36';stroke='#5b8db8';titleColor='#8cc8ff';} ctx.fillStyle=fill;ctx.strokeStyle=stroke;ctx.lineWidth=n.kind==='usage'||n.kind==='object'?2:1;ctx.beginPath();ctx.roundRect(n.x,n.y,w,h,7);ctx.fill();ctx.stroke(); ctx.font=n.kind==='usage'?'600 10px monospace':'700 11px Arial, sans-serif';ctx.fillStyle=titleColor;const lines=wrap(ctx,n.label,w-20,n.kind==='usage'?3:2);lines.forEach((line,i)=>ctx.fillText(line,n.x+10,n.y+22+i*14));ctx.font='9px Arial, sans-serif';ctx.fillStyle=subColor;ctx.fillText(String(n.sub||''),n.x+10,n.y+h-10);});
    ctx.restore();
    return Promise.resolve(canvas.toDataURL('image/png').split(',')[1]);
}
