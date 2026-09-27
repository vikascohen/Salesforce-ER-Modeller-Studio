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


/**
 * Build a complete, multi-page Architecture Intelligence PDF in-browser.
 * No print dialog, server call, external library or Salesforce API request.
 * The architecture map is rendered as vector PDF content and tiled when needed
 * so off-screen canvas content is not lost.
 *
 * @author Vikas Cohen
 */
export function exportArchitectureReportAsPdf(report) {
    if (!report) return Promise.reject(new Error('No Architecture Intelligence report is available.'));
    const W=842,H=595,M=42,R=W-M,usableW=W-M*2;
    const esc=s=>String(s??'').replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)').replace(/[^\x20-\x7E]/g,' ');
    const wrap=(v,max=100)=>{const words=esc(v).split(/\s+/),out=[];let line='';for(const w of words){const n=line?line+' '+w:w;if(n.length>max&&line){out.push(line);line=w;}else line=n;}if(line)out.push(line);return out;};
    const pages=[];let ops=[],y=H-M,pageNo=0,section='';
    const text=(s,x,yy,size=9,bold=false)=>ops.push('BT /F'+(bold?'2':'1')+' '+size+' Tf '+x+' '+yy+' Td ('+esc(s)+') Tj ET');
    const line=(x1,y1,x2,y2,w=.6)=>ops.push(w+' w '+x1+' '+y1+' m '+x2+' '+y2+' l S');
    const rect=(x,yy,w,h)=>ops.push(x+' '+yy+' '+w+' '+h+' re S');
    const footer=()=>{line(M,25,R,25,.35);text('ER Modeller Studio | Data Architecture Intelligence',M,12,6.8,false);text('Page '+pageNo,R-42,12,6.8,false);};
    const begin=(label='')=>{if(ops.length){footer();pages.push(ops.join('\n'));}ops=[];pageNo++;y=H-M;section=label;if(pageNo>1){text('DATA ARCHITECTURE INTELLIGENCE',M,y,7,true);if(label)text(label,R-Math.min(250,label.length*4.2),y,7,false);line(M,y-9,R,y-9,.45);y-=28;}};
    const need=h=>{if(y-h<M+30)begin(section);};
    const title=(s,size=18)=>{need(size+24);text(s,M,y,size,true);y-=size+13;};
    const para=(s,size=8.5,max=112,indent=0)=>{const ls=wrap(s,max);need(ls.length*(size+4)+8);for(const l of ls){text(l,M+indent,y,size,false);y-=size+4;}y-=5;};
    const labelled=(label,value)=>{const ls=wrap(value,108);need(18+ls.length*12);text(label.toUpperCase(),M,y,7,true);y-=12;for(const l of ls){text(l,M+8,y,8.3,false);y-=12;}y-=6;};
    const assessment=(f)=>{const rows=[['What the model shows',f.evidence],['Salesforce interpretation',f.salesforce||f.impact],['Opportunity',f.opportunity],['Challenge to review',f.challenge],['What to inspect next',f.action]].filter(x=>x[1]);let h=42;rows.forEach(x=>h+=18+wrap(x[1],103).length*11);need(Math.min(h,usableW));text((f.kind||'FINDING').toUpperCase(),M,y,7,true);y-=15;text(f.title||'',M,y,12,true);y-=17;if(f.plain)para(f.plain,8.7,108,0);rows.forEach(x=>labelled(x[0],x[1]));line(M,y+3,R,y+3,.35);y-=15;};
    begin('Executive Brief');text('DATA ARCHITECTURE',M,y,10,true);y-=18;text('INTELLIGENCE REPORT',M,y,25,true);y-=34;text(report.fileName||'Current ER model',M,y,13,true);y-=22;para('A deterministic structural assessment of the Salesforce ER model. The report translates relationship topology into review questions, opportunities, change considerations and technical evidence.',10,92);y-=8;
    title('Executive Architecture Brief',16);para(report.summary||'Structural evidence generated from the ER model currently on the canvas.',9.5,105);
    const sig=report.signals||[];for(let i=0;i<sig.length;i+=3){need(58);const row=sig.slice(i,i+3);row.forEach((s,j)=>{const x=M+j*(usableW/3);rect(x,y-43,usableW/3-10,43);text(s.label,x+8,y-14,7,true);text(String(s.value),x+8,y-31,11,true);});y-=55;}
    if(report.reviewLead){title('Where to start',14);labelled(report.reviewLead.name,(report.reviewLead.reason||'')+' '+(report.reviewLead.evidence||'')+' '+(report.reviewLead.reach||''));}
    title('How to read this report',14);para('Start with the findings and architecture map. Use the intelligence sections to understand why an area was highlighted. Finish with domains and the technical evidence appendix when validating design decisions.',8.8,108);
    begin('Architecture Map');
    const map=report.map||{nodes:[],edges:[],width:1100,height:700},scale=.62,tileW=usableW/.62,tileH=(H-M*2-55)/.62,tilesX=Math.max(1,Math.ceil(map.width/tileW)),tilesY=Math.max(1,Math.ceil(map.height/tileH));
    for(let ty=0;ty<tilesY;ty++)for(let tx=0;tx<tilesX;tx++){if(tx||ty)begin('Architecture Map');title('Architecture Map'+(tilesX*tilesY>1?' | '+(ty*tilesX+tx+1)+' of '+tilesX*tilesY:''),16);para('Relationship direction is child to parent. Arrowheads point towards the referenced parent object.',8,112);const ox=tx*tileW,oy=ty*tileH,top=y-5,visible=n=>n.x>=ox-100&&n.x<=ox+tileW+100&&n.y>=oy-80&&n.y<=oy+tileH+80;(map.edges||[]).forEach(e=>{const a=map.nodes.find(n=>n.name===e.child),b=map.nodes.find(n=>n.name===e.parent);if(!a||!b||(!visible(a)&&!visible(b)))return;const x1=M+(a.x-ox)*scale,yy1=top-(a.y-oy)*scale,x2=M+(b.x-ox)*scale,yy2=top-(b.y-oy)*scale;line(x1,yy1,x2,yy2,.6);});(map.nodes||[]).filter(visible).forEach(n=>{const x=M+(n.x-ox)*scale-45,yy=top-(n.y-oy)*scale-15;rect(x,yy,90,30);text(n.name,x+4,yy+18,6.8,true);text((n.degree||0)+' relationships',x+4,yy+7,5.7,false);});}
    begin('Architecture Findings');title('Architecture Findings',18);para('These are review prompts, not architecture scores. Each finding explains the structural evidence in Salesforce terms and suggests what to inspect next.',8.8,108);(report.findings||[]).forEach(assessment);
    begin('Architecture Intelligence');title('Architecture Intelligence',18);para('The following views explain concentration, bridging, dependency routes, directionality, clusters and business boundaries found in the current model.',8.8,108);
    const groups=[['Structural Gravity',report.gravity,'Where relationship concentration, field breadth and model reach converge.'],['Bridge Objects',report.bridges,'Objects that connect structural areas and may deserve cross area impact review.'],['Change Corridors',report.corridors,'Longer relationship routes that can make apparently local changes less local.'],['Relationship Direction',report.asymmetry,'Objects with a strong incoming or outgoing dependency concentration.'],['Complexity Clusters',report.clusters,'Groups of highly connected objects that should be reviewed as a unit.'],['Boundary Leakage',report.boundaryLeakage,'Relationships crossing architect assigned business domains.']];
    groups.forEach(([name,rows,help])=>{title(name,14);para(help,8.3,110);if(!(rows||[]).length)para('No notable signal detected in the current model.',8.2);(rows||[]).forEach(r=>labelled(r.name||r.path||'Observation',r.pdfText||r.detail||r.path||r.name||''));});
    begin('Architecture Domains');title('Architecture Domains',18);para('Domains are architect assigned business capability boundaries. They help distinguish relationships that stay inside a capability from dependencies that cross capability ownership boundaries.',8.8,108);if(!(report.domains||[]).length)para('No domains have been assigned. Consider grouping objects by business capability, for example Customer, Commerce, Provider or Payment, then review cross domain relationships.',8.5,108);(report.domains||[]).forEach(d=>labelled(d.name,(d.objectCount||0)+' objects | '+(d.internalRelationships||0)+' internal relationships | '+(d.crossDomainRelationships||0)+' cross domain relationships.'));
    begin('Technical Evidence');title('Technical Evidence Appendix',18);para('Raw structural evidence is kept here so the main report remains readable while architects can still validate the observations.',8.5,108);title('Model Metrics',13);(report.metrics||[]).forEach(m=>labelled(m.label,String(m.value)));title('Relationship Detail',13);(report.relationships||[]).forEach(r=>labelled(r.childEntity+' -> '+r.parentEntity,'Type: '+(r.kind||'relationship')+(r.fieldName?' | Field: '+r.fieldName:'')));
    title('Interpretation Boundary',13);para('This report describes deterministic structural evidence from the ER model. It does not score architecture quality and does not assess permissions, CRUD/FLS, vulnerabilities or security posture. Business context remains necessary before making a design decision.',8.5,108);
    footer();pages.push(ops.join('\n'));
    const objects=[null],add=o=>{objects.push(o);return objects.length-1;},font1=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'),font2=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>'),pageIds=[],contentIds=[];
    pages.forEach(p=>{contentIds.push(add('<< /Length '+p.length+' >>\nstream\n'+p+'\nendstream'));pageIds.push(add(''));});const pagesId=add('');pageIds.forEach((id,i)=>objects[id]='<< /Type /Page /Parent '+pagesId+' 0 R /MediaBox [0 0 '+W+' '+H+'] /Resources << /Font << /F1 '+font1+' 0 R /F2 '+font2+' 0 R >> >> /Contents '+contentIds[i]+' 0 R >>');objects[pagesId]='<< /Type /Pages /Kids ['+pageIds.map(id=>id+' 0 R').join(' ')+'] /Count '+pageIds.length+' >>';const catalog=add('<< /Type /Catalog /Pages '+pagesId+' 0 R >>');let pdf='%PDF-1.4\n',offsets=[0];for(let i=1;i<objects.length;i++){offsets[i]=pdf.length;pdf+=i+' 0 obj\n'+objects[i]+'\nendobj\n';}const xref=pdf.length;pdf+='xref\n0 '+objects.length+'\n0000000000 65535 f \n';for(let i=1;i<objects.length;i++)pdf+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';pdf+='trailer\n<< /Size '+objects.length+' /Root '+catalog+' 0 R >>\nstartxref\n'+xref+'\n%%EOF';return Promise.resolve(btoa(pdf));
}
