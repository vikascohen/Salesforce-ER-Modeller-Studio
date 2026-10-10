/** Shared best-effort diagnostic sink for the Studio, asynchronous scans and hosted MCP tools.
 * Never use as a substitute for durable Field Usage run/work-unit checkpoints.
 * Only emits after callouts and after any savepoint rollback; does not propagate failures.
 */
public without sharing class ErStudioDiagnosticService {
    // Only ER Modeller Studio-owned components may emit diagnostics.
    // This is deliberately not a Salesforce platform exception monitor.
    private static final Set<String> STUDIO_SOURCES=new Set<String>{
        'Studio','Studio component','Model validation','ER Modelling','DSL',
        'Architecture Intelligence','Data Dictionary','Field Usage',
        'Field Usage Scheduler','Hosted MCP','MCP Settings','Diagnostic Settings',
        'Studio Settings','Diagram Export','Diagram Import','Studio Files'
    };
    private static Integer attempts=0;
    private static final Integer MAX_EVENTS_PER_TRANSACTION=10;
    public static Boolean error(String source,String operation,String message) {
        return emit(source,operation,'ERROR',message);
    }
    public static Boolean warning(String source,String operation,String message) {
        return emit(source,operation,'WARN',message);
    }
    public static Boolean exception(String source,String operation,Exception ex) {
        return error(source,operation,ex==null?'Unknown exception':ex.getTypeName()+': '+ex.getMessage());
    }
    @TestVisible private static Boolean emit(String source,String operation,String severity,String message) {
        if(!STUDIO_SOURCES.contains(source) || attempts>=MAX_EVENTS_PER_TRANSACTION || String.isBlank(message))return false;
        attempts++;
        try {
            String context='['+safe(source,65)+' / '+safe(operation,65)+'] ';
            return ErDiagnosticConfigController.recordEvent(context+message.left(3500),severity);
        }catch(Exception ignored){return false;}
    }
    private static String safe(String value,Integer max){return String.isBlank(value)?'Unknown':value.left(max).replaceAll('[\\r\\n\\t]',' ');}
}
