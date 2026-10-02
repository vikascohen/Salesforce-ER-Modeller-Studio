import { LightningElement } from 'lwc';
import FIRST_NAME from '@salesforce/schema/Contact.FirstName';
import LAST_NAME from '@salesforce/schema/Contact.LastName';

export default class FieldUsageTestContact extends LightningElement {
    firstNameField = FIRST_NAME;
    lastNameField = LAST_NAME;
}
