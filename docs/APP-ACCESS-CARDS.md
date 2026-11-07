# Named access cards in app-generated models

Enable **Show permission set and licence names as access cards** in Generate ER Model from App. This replaces the old full technical-object toggle. Known platform/security/licensing tables remain excluded from generated data models. Manual object imports and old saved diagrams are unchanged.

Discovery resolves the selected AppDefinition to its AppMenuItem TabSet identity, then reads explicit SetupEntityAccess grants for that app and reached Apex class IDs. It excludes profile-owned permission sets. Permission set cards show their labels and namespace-qualified API names. PermissionSet.LicenseId is followed to the specific PermissionSetLicense or UserLicense record. A namespaced app can also show its actual PackageLicense record; its installed package name is loaded when accessible, otherwise the card explicitly identifies the namespace. No org-wide licence list or per-user assignments are inferred.

These cards describe access configuration. They do not assert mandatory assignments, licence ownership, execution order, or all possible routes to access. Profiles, permission set groups, indirect feature licences, and Flow-specific grants are not included in this initial coverage. Missing identities and inaccessible package labels produce coverage warnings; query failures and truncation prevent a misleading partial result. The existing strict app-used field evidence rule remains in force.

Access cards occupy their own fitted section below Apex/Flow cards. They have no Id/field rows and do not participate in schema heatmap, sharing or object dependency analysis. Their labels persist in the DSL, saved files, imports, viewer and supported exports:

```text
component PermissionSet LoggerAdmin label "Logger Admin"
component PermissionSetLicense LoggerLicence label "Example CRM Licence"
component UserLicense SalesforceLicence label "Salesforce"
component PackageLicense ExamplePackage label "Example Package"
```

Use JSON string escaping for labels. Module definitions can contain these declarations and remain inert until `use`. The generated identifier is based on the record ID so equal labels do not merge distinct access records. IntelliSense covers every card type, the `label` keyword/caret position and matching JSON-escaped display labels. Access-name candidates come from current/imported declarations (so reopening saved DSL works) and the selected app’s resolved cards; incomplete source is tolerated. No unrelated org-wide permission/licence list is queried for completion.

Regenerate an app model to add named access cards; a fresh org scan is not required for this metadata lookup. Existing scans still determine app/component/field scope.

Salesforce references: [SetupEntityAccess](https://developer.salesforce.com/docs/platform/object-reference/references/standard-objects/object-setupentityaccess.html), [PermissionSet](https://developer.salesforce.com/docs/platform/field-reference/references/field-reference/salesforce-field-reference-permissionset.html).
