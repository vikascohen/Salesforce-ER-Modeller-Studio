import { LightningElement } from 'lwc';

export default class DiagramLanguageReference extends LightningElement {
    model = [
        'entity Account : Name[Required]',
        'entity Contact : LastName[Required], Email',
        'Contact.AccountId -> Account'
    ].join('\n');
    library = [
        'export module Customer {',
        '    entity Account : Name',
        '    component ApexClass CustomerService label "Customer service"',
        '}'
    ].join('\n');
    consumer = [
        'import Customer from customer.dsl',
        'export module Sales extends Customer {',
        '    entity Opportunity : Amount[Currency], CloseDate[Date]',
        '    Opportunity.AccountId -> Account',
        '}',
        'use Sales'
    ].join('\n');
}
