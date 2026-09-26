/**
 * SVG → PNG export utilities — LWS-safe.
 * Renders SVG to a canvas and returns base64 PNG. No download attempted here.
 * Download is handled by the caller via Salesforce Files + NavigationMixin.
 *
 * @author Vikas Cohen
 */

export const PAGE_SIZES = {
    PNG: null,
    A4:  { w: 1123, h: 794,  label: 'A4 Landscape' },
    A3:  { w: 1587, h: 1123, label: 'A3 Landscape' }
};

/**
 * Render an SVG element to a PNG.
 * @param {SVGElement} svgElement
 * @param {string}     pageSize   'PNG' | 'A4' | 'A3'
 * @param {string}     [bgColor]  default #ffffff
 * @returns {Promise<string>}     base64 PNG (no data-URI prefix)
 */
export function exportSvgAsPng(svgElement, pageSize, bgColor) {
    if (!svgElement) return Promise.reject(new Error('No SVG element found — make sure a diagram is open.'));

    const bg   = bgColor || '#ffffff';
    const size = PAGE_SIZES[pageSize] || null;

    const vb   = svgElement.viewBox && svgElement.viewBox.baseVal;
    const srcW = (vb && vb.width)  || svgElement.getBoundingClientRect().width  || 800;
    const srcH = (vb && vb.height) || svgElement.getBoundingClientRect().height || 600;

    const scale = 2;
    let canvasW, canvasH, drawX, drawY, drawW, drawH;

    if (size) {
        const margin = 20;
        const fitW   = size.w - margin * 2;
        const fitH   = size.h - margin * 2;
        const ratio  = Math.min(fitW / srcW, fitH / srcH);
        drawW = srcW * ratio; drawH = srcH * ratio;
        drawX = margin + (fitW - drawW) / 2;
        drawY = margin + (fitH - drawH) / 2;
        canvasW = size.w; canvasH = size.h;
    } else {
        drawX = 0; drawY = 0; drawW = srcW; drawH = srcH;
        canvasW = srcW; canvasH = srcH;
    }

    // Serialize SVG → base64 data URI (no Blob, no createObjectURL)
    const clone = svgElement.cloneNode(true);
    clone.setAttribute('width',  srcW);
    clone.setAttribute('height', srcH);
    clone.setAttribute('xmlns',  'http://www.w3.org/2000/svg');
    clone.removeAttribute('data-role');
    const svgString = new XMLSerializer().serializeToString(clone);
    const svgUri    = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgString)));

    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            try {
                const canvas  = document.createElement('canvas');
                canvas.width  = Math.round(canvasW * scale);
                canvas.height = Math.round(canvasH * scale);
                const ctx = canvas.getContext('2d');
                ctx.scale(scale, scale);
                ctx.fillStyle = bg;
                ctx.fillRect(0, 0, canvasW, canvasH);
                if (size) {
                    ctx.strokeStyle = '#cccccc';
                    ctx.lineWidth   = 0.5;
                    ctx.strokeRect(1, 1, canvasW - 2, canvasH - 2);
                }
                ctx.drawImage(img, drawX, drawY, drawW, drawH);

                let pngDataUri;
                try {
                    pngDataUri = canvas.toDataURL('image/png');
                } catch (e) {
                    reject(new Error('Canvas security error: ' + e.message));
                    return;
                }

                resolve(pngDataUri.split(',')[1]);
            } catch (e) {
                reject(e);
            }
        };
        img.onerror = () => reject(new Error('Failed to render SVG. The diagram may contain unsupported elements.'));
        img.src = svgUri;
    });
}


/**
 * Render a comprehensive Architecture Intelligence report as a high-resolution PNG.
 * The report is generated entirely in the browser from already-computed Phase 2
 * analysis, so exporting does not trigger additional Salesforce requests.
 *
 * @author Vikas Cohen
 */
export function exportArchitectureReportAsPng(report) {
    if (!report) return Promise.reject(new Error('No Architecture Intelligence report is available.'));
    const W=1800, margin=72, colGap=24, cardRadius=14;
    const findings=report.findings||[], nodes=(report.nodes||[]).slice(0,10), domains=(report.domains||[]).slice(0,8);
    const wrap=(ctx,text,maxWidth)=>{const words=String(text||'').split(/\s+/);const lines=[];let line='';words.forEach(word=>{const test=line?line+' '+word:word;if(ctx.measureText(test).width>maxWidth&&line){lines.push(line);line=word;}else line=test;});if(line)lines.push(line);return lines;};
    const canvas=document.createElement('canvas'), ctx=canvas.getContext('2d');
    const text=(value,x,y,size=22,weight='400',color='#25324a')=>{ctx.font=weight+' '+size+'px Arial, sans-serif';ctx.fillStyle=color;ctx.fillText(String(value??''),x,y);};
    const paragraph=(value,x,y,maxWidth,size=20,lineHeight=29,color='#53627a',maxLines=8)=>{ctx.font='400 '+size+'px Arial, sans-serif';ctx.fillStyle=color;const lines=wrap(ctx,value,maxWidth).slice(0,maxLines);lines.forEach((line,i)=>ctx.fillText(line,x,y+i*lineHeight));return y+lines.length*lineHeight;};
    const card=(x,y,w,h)=>{ctx.fillStyle='#ffffff';ctx.strokeStyle='#dfe5ef';ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(x,y,w,h,cardRadius);ctx.fill();ctx.stroke();};
    const pill=(value,x,y)=>{ctx.font='700 15px Arial, sans-serif';const w=ctx.measureText(value).width+24;ctx.fillStyle='#eef4ff';ctx.beginPath();ctx.roundRect(x,y-19,w,28,14);ctx.fill();text(value,x+12,y,15,'700','#3569b8');return w;};
    const bar=(label,value,max,x,y,w)=>{text(label,x,y,17,'600','#53627a');const bw=Math.max(3,w*(max?value/max:0));ctx.fillStyle='#edf1f7';ctx.fillRect(x,y+12,w,12);ctx.fillStyle='#4b76bd';ctx.fillRect(x,y+12,bw,12);text(value,x+w+12,y+23,16,'700','#25324a');};
    let estimated=510+findings.length*205+Math.max(360,nodes.length*40)+Math.max(260,domains.length*42);
    canvas.width=W;canvas.height=Math.max(1700,estimated);ctx.fillStyle='#f5f7fb';ctx.fillRect(0,0,canvas.width,canvas.height);
    let y=70;
    text('SALESFORCE ER MODELLER STUDIO',margin,y,17,'700','#3569b8');y+=45;
    text('Data Architecture Intelligence',margin,y,42,'700','#17233a');y+=38;
    text(report.fileName||'Current ER model',margin,y,21,'600','#53627a');y+=48;
    y=paragraph(report.summary,margin,y,W-margin*2,23,34,'#34435d',7)+28;
    const signals=report.signals||[];const sw=(W-margin*2-(signals.length-1)*12)/Math.max(signals.length,1);
    signals.forEach((s,i)=>{card(margin+i*(sw+12),y,sw,92);text(s.label,margin+i*(sw+12)+16,y+29,14,'700','#75829a');text(s.value,margin+i*(sw+12)+16,y+62,20,'700','#25324a');});y+=122;
    if(report.reviewLead){card(margin,y,W-margin*2,145);pill('REVIEW FIRST',margin+18,y+32);text(report.reviewLead.name,margin+155,y+35,25,'700','#17233a');paragraph(report.reviewLead.reason,margin+18,y+72,W-margin*2-36,18,26,'#53627a',2);text(report.reviewLead.evidence+' · '+report.reviewLead.reach,margin+18,y+126,16,'600','#3569b8');y+=175;}
    text('Architecture findings',margin,y,27,'700','#17233a');y+=25;
    findings.forEach(f=>{card(margin,y,W-margin*2,180);pill(f.kind,margin+18,y+31);text(f.title,margin+18,y+69,21,'700','#25324a');const cw=(W-margin*2-72)/3;[['Evidence',f.evidence],['Why it matters',f.impact],['Investigate',f.action]].forEach((v,i)=>{const x=margin+18+i*(cw+18);text(v[0],x,y+101,13,'700','#75829a');paragraph(v[1],x,y+126,cw,16,22,'#53627a',2);});y+=195;});
    y+=10;text('Model shape graph',margin,y,27,'700','#17233a');y+=28;
    card(margin,y,W-margin*2,Math.max(300,nodes.length*42+85));text('Most connected objects',margin+18,y+32,18,'700','#25324a');
    const maxDegree=Math.max(1,...nodes.map(n=>n.degree));nodes.forEach((n,i)=>bar(n.name,n.degree,maxDegree,margin+18,y+66+i*40,620)); 
    const chartX=margin+850; text('Relationship composition',chartX,y+32,18,'700','#25324a');
    const rels=report.relationshipMix||[];const total=Math.max(1,rels.reduce((s,r)=>s+r.value,0));let by=y+70;rels.forEach(r=>{text(r.label,chartX,by,16,'600','#53627a');ctx.fillStyle='#edf1f7';ctx.fillRect(chartX+180,by-14,500,18);ctx.fillStyle='#4b76bd';ctx.fillRect(chartX+180,by-14,500*r.value/total,18);text(r.value,chartX+695,by,16,'700','#25324a');by+=40;});y+=Math.max(330,nodes.length*42+115);
    if(domains.length){text('Architecture domains',margin,y,27,'700','#17233a');y+=28;card(margin,y,W-margin*2,domains.length*42+70);const maxObjects=Math.max(1,...domains.map(d=>d.objectCount));domains.forEach((d,i)=>bar(d.name,d.objectCount,maxObjects,margin+18,y+42+i*40,700));y+=domains.length*42+100;}
    text('Technical evidence',margin,y,27,'700','#17233a');y+=28;card(margin,y,W-margin*2,220);
    const metrics=report.metrics||[];metrics.slice(0,9).forEach((m,i)=>{const x=margin+18+(i%3)*520, yy=y+40+Math.floor(i/3)*60;text(m.label,x,yy,14,'700','#75829a');text(m.value,x,yy+25,19,'700','#25324a');});y+=250;
    text('Interpretation boundary',margin,y,18,'700','#17233a');y+=27;paragraph('This report describes structural evidence from the ER model. It does not score architecture quality and does not assess permissions, CRUD/FLS, vulnerabilities or security posture.',margin,y,W-margin*2,16,24,'#75829a',3);y+=85;
    canvas.height=Math.min(canvas.height,Math.ceil(y+40));
    return Promise.resolve(canvas.toDataURL('image/png').split(',')[1]);
}
