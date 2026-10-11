/**
 * @author Vikas Cohen
 */
import {classifyDiagnostic,appendDiagnostic,filterDiagnostics} from 'c/erDiagnosticModel';
describe('diagnostic model',()=>{
 it('offers evidence-specific steps and explains affected functionality',()=>{const e=classifyDiagnostic('Tooling API authentication failed');expect(e.category).toBe('Connection');expect(e.impact).toMatch(/Salesforce/);expect(e.steps.length).toBeGreaterThan(1);});
 it('does not pretend to know the cause of an unclassified error',()=>{const e=classifyDiagnostic('unexpected xyz');expect(e.summary).toMatch(/could not/);expect(e.steps.join(' ')).not.toMatch(/authentication failed/);});
 it('deduplicates by source and retains bounded history',()=>{const a=classifyDiagnostic('Export failed','Studio');const b=classifyDiagnostic('Export failed','Studio');const result=appendDiagnostic([a],b);expect(result).toHaveLength(1);expect(result[0].count).toBe(2);expect(appendDiagnostic(result,classifyDiagnostic('other'),1)).toHaveLength(1);});
 it('redacts credential values before retaining or persisting',()=>{const e=classifyDiagnostic('Authorization: Bearer abc123 password=secret');expect(e.message).not.toContain('abc123');expect(e.message).not.toContain('secret');});
 it('filters by text and severity',()=>{const e=classifyDiagnostic('DSL syntax error');expect(filterDiagnostics([e],'syntax','ERROR')).toHaveLength(1);expect(filterDiagnostics([e],'syntax','WARN')).toHaveLength(0);});
});
