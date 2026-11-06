import { collectAppScope, describeInChunks } from 'c/appModelLogic';
const comp = (type,name) => ({type,name});
it('follows only reached components, handles cycles and keeps inclusion evidence', async () => {
    const expand = jest.fn(async ({components}) => ({components: components.flatMap(c => ({
        Sales: [comp('LightningComponentBundle','salesPanel'),comp('Object','Account')],
        salesPanel: [comp('ApexClass','SalesService')],
        SalesService: [comp('Object','Opportunity'),comp('LightningComponentBundle','salesPanel')]
    }[c.name] || [])), reasons:['Static reference'], warnings:['Static evidence']}));
    const result = await collectAppScope({runId:'run',components:[comp('CustomApplication','Sales')]},expand);
    expect(result.objects).toEqual(['Account','Opportunity']);
    expect(result.componentCount).toBe(5);
    expect(result.reasons).toEqual(['Static reference']);
    expect(result.warnings).toEqual(['Static evidence']);
});
it('continues dependency pages without dropping later objects', async () => {
    const expand=jest.fn(async ({components,cursor}) => components[0].type==='Object'?{}:cursor?{components:[comp('Object','Contact')]}:{components:[comp('Object','Account')],nextCursor:'page2'});
    const result=await collectAppScope({components:[comp('CustomApplication','Sales')]},expand);
    expect(result.objects).toEqual(['Account','Contact']);
});
it('rejects repeated pagination cursors', async () => {
    await expect(collectAppScope({components:[comp('CustomApplication','Sales')]},async () => ({nextCursor:'same'}))).rejects.toThrow('repeated');
});
it('propagates scan failure instead of returning a partial model', async () => {
    await expect(collectAppScope({components:[comp('CustomApplication','Sales')]},async () => {throw new Error('Snapshot unavailable');})).rejects.toThrow('Snapshot unavailable');
});
it('deduplicates objects case insensitively', async () => {
    const result=await collectAppScope({components:[comp('Object','Account'),comp('Object','account')]},async () => ({}));
    expect(result.objects).toEqual(['Account']);
});
it('loads schema in safe chunks and rejects missing objects', async () => {
    const names=Array.from({length:23},(_,i)=>`Object${i}`);
    const describe=jest.fn(async ({objectApiNames})=>objectApiNames.map(apiName=>({apiName,fields:[]})));
    expect(await describeInChunks(names,describe)).toHaveLength(23);
    expect(describe.mock.calls.map(c=>c[0].objectApiNames.length)).toEqual([10,10,3]);
    await expect(describeInChunks(['Account','Contact'],async ()=>[{apiName:'Account'}])).rejects.toThrow('Contact');
});
it('rejects empty and oversized scope',async()=>{
    await expect(collectAppScope({components:[]},async()=>({}))).rejects.toThrow('No resolvable');
    await expect(collectAppScope({components:Array.from({length:151},(_,i)=>comp('Object',`Object${i}`))},async()=>({}))).rejects.toThrow('150 objects');
});

it('preserves dependency warnings when a completed scan resolves no app objects', async () => {
    try {
        await collectAppScope({runId:'completed-scan',components:[{type:'CustomTab',name:'ComponentOnlyTab'}]},async()=>({warnings:['Salesforce component dependency coverage is unavailable: HTTP 400']}));
        throw new Error('Expected unresolved scope');
    } catch(error) {
        expect(error.code).toBe('APP_OBJECTS_NOT_RESOLVED');
        expect(error.scanAvailable).toBe(true);
        expect(error.coverageWarnings).toContain('Salesforce component dependency coverage is unavailable: HTTP 400');
    }
});
