/** Pure, bounded diagnostic classification. Never infer a root cause without evidence. */
const GUIDANCE = [
 {pattern:/tooling api|named credential|authentication|unauthori[sz]ed|401\b/i,category:'Connection',summary:'A Salesforce connection or authentication operation failed.',impact:'The operation requiring Salesforce access may not have completed.',steps:['Check the configured Salesforce connection and its authorised principal.','Confirm the running user has access to the requested operation.','Retry the affected operation after correcting the connection.']},
 {pattern:/field usage|snapshot|scan|batch apex/i,category:'Field Usage',summary:'A Field Usage operation did not complete as expected.',impact:'Field dependency information may be incomplete or out of date.',steps:['Open Settings → Diagnostics and run the application health check.','Review the latest Field Usage scan status and errors.','Retry the affected scan or query after addressing any reported problem.']},
 {pattern:/export|mermaid|draw\.io|lucidchart|excel|png/i,category:'Export',summary:'The requested diagram export could not be completed.',impact:'The requested export file may not have been generated.',steps:['Confirm the diagram contains a valid model.','Try the export again; if it fails, capture the technical details below.']},
 {pattern:/parse|syntax|dsl|line \d+|invalid token/i,category:'DSL',summary:'The model text could not be processed.',impact:'The model may not have been updated from the supplied text.',steps:['Review the DSL editor for syntax or validation errors.','Correct the indicated text or line, then try again.']},
 {pattern:/access|permission|insufficient privileges|forbidden|403\b/i,category:'Access',summary:'The requested operation was denied.',impact:'The affected Salesforce operation could not be completed.',steps:['Check access to the object, field or feature named in the message.','Ask your Salesforce administrator to verify the required permissions.']}
];
export function classifyDiagnostic(message,source='Studio',severity='ERROR',timestamp=new Date().toISOString()) {
 const technical=String(message||'Unknown error').slice(0,4000)
  .replace(/(authorization\s*:\s*bearer\s+)\S+/gi,'$1[REDACTED]')
  .replace(/((?:access_token|refresh_token|client_secret|password|api_key)\s*[:=]\s*[\"']?)[^\s,;\"'}]+/gi,'$1[REDACTED]');
 const guidance=GUIDANCE.find(item=>item.pattern.test(technical));
 return {id:timestamp+'-'+Math.random().toString(36).slice(2,9),timestamp,severity,source,category:guidance?.category||'Application',summary:guidance?.summary||'An application operation could not be completed.',impact:guidance?.impact||'The affected operation may not have completed.',steps:guidance?.steps||['Review the operation that failed and any relevant configuration.','Retry once; if it persists, provide the technical details to your administrator.'],message:technical,count:1};
}
export function appendDiagnostic(events,entry,max=500) {
 const existing=events.find(e=>e.message===entry.message&&e.source===entry.source&&e.severity===entry.severity);
 if(existing)return [{...existing,count:existing.count+1,timestamp:entry.timestamp},...events.filter(e=>e.id!==existing.id)].slice(0,max);
 return [entry,...events].slice(0,max);
}
export function filterDiagnostics(events,query='',severity='') {
 const term=query.toLowerCase().trim();return events.filter(e=>(!severity||e.severity===severity)&&(!term||[e.summary,e.message,e.category,e.source].some(v=>v.toLowerCase().includes(term))));
}
