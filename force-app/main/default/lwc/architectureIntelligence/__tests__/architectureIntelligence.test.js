/**
 * Phase 2 — Data Architecture Intelligence tests.
 * Author: Vikas Cohen
 */
import { analyseArchitecture, analyseObject, findArchitecturePath, analyseBlastRadius, detectJunctionObjects, analyseDomains } from 'c/architectureIntelligence';
describe('architecture intelligence',()=>{it('calculates graph metrics without security concerns',()=>{const m={entities:[{name:'Account',fields:[{name:'Name'}]},{name:'Contact',fields:[{name:'AccountId',isRelationship:true}]},{name:'Island__c',fields:[]}],relationships:[{childEntity:'Contact',childField:'AccountId',parentEntity:'Account',kind:'lookup'}]};const a=analyseArchitecture(m);expect(a.entityCount).toBe(3);expect(a.relationshipCount).toBe(1);expect(a.lookupCount).toBe(1);expect(a.islands.map(x=>x.name)).toContain('Island__c');expect(a.nodes[0].degree).toBe(1);expect(a.averageDegree).toBeCloseTo(0.67,2);expect(a.componentCount).toBe(2);expect(a.mostConnected.length).toBeGreaterThan(0);expect(a.largestObjects.length).toBeGreaterThan(0);});it('detects cycles',()=>{const m={entities:['A','B','C'].map(name=>({name,fields:[]})),relationships:[['A','B'],['B','C'],['C','A']].map(([childEntity,parentEntity])=>({childEntity,parentEntity,childField:'x',kind:'lookup'}))};expect(analyseArchitecture(m).cycles.length).toBeGreaterThan(0);});});
describe('architecture intelligence performance guards',()=>{it('handles a larger cyclic graph with bounded cycle output',()=>{const entities=Array.from({length:120},(_,i)=>({name:'Obj'+i,fields:[]}));const relationships=Array.from({length:120},(_,i)=>({childEntity:'Obj'+i,parentEntity:'Obj'+((i+1)%120),childField:'ParentId',kind:'lookup'}));const a=analyseArchitecture({entities,relationships});expect(a.entityCount).toBe(120);expect(a.cycles.length).toBeLessThanOrEqual(25);expect(a.maxRelationshipDepth).toBeGreaterThan(0);});});

describe('architecture intelligence error handling',()=>{it('rejects malformed models clearly',()=>{expect(()=>analyseArchitecture(null)).toThrow('parsed ER model');expect(()=>analyseArchitecture({entities:[{name:''}],relationships:[]})).toThrow('non-empty name');});it('skips relationships with missing endpoints instead of crashing',()=>{const a=analyseArchitecture({entities:[{name:'Account',fields:[]}],relationships:[{childEntity:'Missing__c',parentEntity:'Account',childField:'Account__c',kind:'lookup'}]});expect(a.ignoredRelationships).toHaveLength(1);expect(a.observations.some(o=>o.title==='Relationships skipped')).toBe(true);});});

describe('object architecture drill-down',()=>{it('calculates parents, children and bounded reach',()=>{const m={entities:['Account','Contact','Case','Task'].map(name=>({name,fields:[]})),relationships:[{childEntity:'Contact',parentEntity:'Account',childField:'AccountId',kind:'lookup'},{childEntity:'Case',parentEntity:'Account',childField:'AccountId',kind:'lookup'},{childEntity:'Task',parentEntity:'Case',childField:'WhatId',kind:'poly'}]};const a=analyseArchitecture(m);const d=analyseObject(a,'Account');expect(d.children.map(x=>x.name)).toEqual(expect.arrayContaining(['Contact','Case']));expect(d.reach1.count).toBe(2);expect(d.reach2.names).toContain('Task');expect(d.reachableWithin3).toBe(3);});});

describe('phase 2 graph exploration',()=>{const model={entities:['Account','Contact','Case','Task','CaseContact__c'].map(name=>({name,fields:[]})),relationships:[{childEntity:'Contact',parentEntity:'Account',kind:'lookup'},{childEntity:'Case',parentEntity:'Account',kind:'lookup'},{childEntity:'Task',parentEntity:'Case',kind:'poly'},{childEntity:'CaseContact__c',parentEntity:'Case',kind:'master'},{childEntity:'CaseContact__c',parentEntity:'Contact',kind:'master'}]};it('finds a shortest structural path',()=>{const a=analyseArchitecture(model),r=findArchitecturePath(a,'Contact','Task');expect(r.found).toBe(true);expect(r.hops).toBe(3);expect(r.path[0]).toBe('Contact');expect(r.path[r.path.length-1]).toBe('Task');});it('calculates bounded blast radius',()=>{const a=analyseArchitecture(model),r=analyseBlastRadius(a,'Account',2);expect(r.maxDepth).toBe(2);expect(r.total).toBeGreaterThan(2);});it('detects a strong master-detail junction',()=>{const a=analyseArchitecture(model),j=detectJunctionObjects(a).find(x=>x.name==='CaseContact__c');expect(j.confidence).toBe('Strong');expect(j.distinctTargets).toBe(2);});});

describe('architecture domains',()=>{it('summarises domains and cross-domain coupling from architect assignments',()=>{const model={entities:[{name:'Claim__c',fields:[{},{}]},{name:'Payment__c',fields:[{}]},{name:'Provider__c',fields:[{}]},{name:'Note__c',fields:[]}],relationships:[{childEntity:'Payment__c',parentEntity:'Claim__c',kind:'lookup'},{childEntity:'Claim__c',parentEntity:'Provider__c',kind:'lookup'},{childEntity:'Note__c',parentEntity:'Claim__c',kind:'lookup'}]};const a=analyseArchitecture(model);const d=analyseDomains(a,{'Claim__c':'Claim','Note__c':'Claim','Payment__c':'Payment','Provider__c':'Provider'});expect(d.domains.find(x=>x.name==='Claim').objectCount).toBe(2);expect(d.domains.find(x=>x.name==='Claim').internalRelationships).toBe(1);expect(d.couplings.find(x=>x.domainA==='Claim'&&x.domainB==='Payment').relationshipCount).toBe(1);expect(d.couplings).toHaveLength(2);expect(d.unassigned).toHaveLength(0);});it('reports unassigned objects without guessing their business domain',()=>{const a=analyseArchitecture({entities:[{name:'A',fields:[]},{name:'B',fields:[]}],relationships:[]});const d=analyseDomains(a,{A:'Core'});expect(d.unassigned).toEqual(['B']);});});


describe('phase 2 reusable graph indexes', () => {
    it('keeps internal indexes non-enumerable while reusing them across exploration features', () => {
        const entities = Array.from({ length: 500 }, (_, i) => ({ name: 'Obj' + i, fields: [] }));
        const relationships = Array.from({ length: 499 }, (_, i) => ({
            childEntity: 'Obj' + (i + 1),
            parentEntity: 'Obj' + i,
            childField: 'ParentId',
            kind: 'lookup'
        }));
        const analysis = analyseArchitecture({ entities, relationships });

        expect(Object.keys(analysis)).not.toContain('_graphIndex');
        expect(analysis._graphIndex.adj.size).toBe(500);
        expect(analysis._graphIndex.outboundByNode.size).toBe(500);
        expect(analysis._graphIndex.inboundByNode.size).toBe(500);

        expect(findArchitecturePath(analysis, 'Obj0', 'Obj499').hops).toBe(499);
        expect(analyseBlastRadius(analysis, 'Obj0', 3).levels[0].count).toBe(1);
        expect(analyseObject(analysis, 'Obj250').neighbors).toHaveLength(2);
    });

    it('indexes outbound relationships once for junction detection on a large model', () => {
        const entities = Array.from({ length: 600 }, (_, i) => ({ name: 'Obj' + i, fields: [] }));
        const relationships = [];
        for (let i = 2; i < 600; i++) {
            relationships.push({
                childEntity: 'Obj' + i,
                parentEntity: 'Obj0',
                kind: i === 2 ? 'master' : 'lookup'
            });
            relationships.push({
                childEntity: 'Obj' + i,
                parentEntity: 'Obj1',
                kind: i === 2 ? 'master' : 'lookup'
            });
        }
        const analysis = analyseArchitecture({ entities, relationships });
        const junctions = detectJunctionObjects(analysis);

        expect(junctions).toHaveLength(598);
        expect(junctions.find(item => item.name === 'Obj2').confidence).toBe('Strong');
    });
});
