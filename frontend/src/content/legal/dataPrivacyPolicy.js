/** Full Data Privacy Policy — Effective June 2026, RA 10173 compliant */
export const DATA_PRIVACY_POLICY = {
  title: 'Data Privacy Policy',
  subtitle: 'In compliance with Republic Act No. 10173 — Data Privacy Act of 2012',
  effectiveDate: 'June 2026',
  sections: [
    {
      number: 1,
      title: 'Introduction',
      blocks: [
        {
          type: 'paragraph',
          text: 'This Data Privacy Policy describes how Providential 628 Site Preparation Services, as the Personal Information Controller (PIC), collects, uses, stores, and protects the personal information of users of the Deliverex system. Deliverex is an integrated logistics management platform comprising a web application, a native Android mobile application, and a customer-facing Progressive Web Application (PWA), developed to support fleet dispatch optimization, delivery status tracking, and OCR-based documentation management.',
        },
        {
          type: 'paragraph',
          text: 'This policy is issued in compliance with Republic Act No. 10173, also known as the Data Privacy Act of 2012, and its Implementing Rules and Regulations (IRR). By registering an account or using any component of the Deliverex system, you acknowledge that you have read, understood, and agreed to the terms of this policy.',
        },
      ],
    },
    {
      number: 2,
      title: 'Scope of This Policy',
      blocks: [
        {
          type: 'paragraph',
          text: 'This policy applies to all personal information collected and processed through the Deliverex system, including but not limited to:',
        },
        {
          type: 'list',
          items: [
            'Customer users who register accounts, track deliveries, and access the chatbot through the Deliverex web application, Progressive Web Application, or native Android mobile application.',
            'Driver users who manage job assignments, submit delivery status updates, and capture delivery documents through the Deliverex native Android mobile application.',
            'Internal users — dispatchers, administrators, and managers — who access the Deliverex web application to perform operational, administrative, and supervisory functions.',
          ],
        },
        {
          type: 'paragraph',
          text: 'This policy does not apply to third-party websites, platforms, or services that may be linked from the Deliverex system.',
        },
      ],
    },
    {
      number: 3,
      title: 'Personal Information We Collect',
      subsections: [
        {
          number: '3.1',
          title: 'Customer Users',
          blocks: [
            {
              type: 'paragraph',
              text: 'The following personal information is collected from customer users upon registration and system use:',
            },
            {
              type: 'list',
              items: [
                'Full name',
                'Email address',
                'Account password (stored in encrypted form)',
                'Delivery transaction history associated with the customer account',
                'Proof of delivery documents accessible through the customer account',
                'Session activity logs including login timestamps and access events',
              ],
            },
          ],
        },
        {
          number: '3.2',
          title: 'Driver Users',
          blocks: [
            {
              type: 'paragraph',
              text: 'The following personal information is collected from driver users as maintained in the system by the administrator:',
            },
            {
              type: 'list',
              items: [
                'Full name',
                'Contact information',
                'Driver\'s license details and license classification',
                'Availability status and current job assignment',
                'Delivery history and status update records',
                'Optional GPS coordinates recorded at the time of delivery status updates when location services are available on the device',
                'Session activity logs including login timestamps and access events',
              ],
            },
          ],
        },
        {
          number: '3.3',
          title: 'Internal Users (Dispatcher, Administrator, Manager)',
          blocks: [
            {
              type: 'paragraph',
              text: 'The following information is collected from internal users:',
            },
            {
              type: 'list',
              items: [
                'Full name and assigned role within the system',
                'Email address and account credentials',
                'System activity logs including job order creation, dispatch actions, OCR validation events, and configuration changes',
              ],
            },
          ],
        },
        {
          number: '3.4',
          title: 'Visitors (Unauthenticated Users)',
          blocks: [{
            type: 'paragraph',
            text: 'Users who access the public landing page, Track Delivery feature, or Chatbot without logging in do not provide personally identifiable account information. Tracking ID queries submitted by unauthenticated users are processed as stateless requests and are not linked to any stored user profile.',
          }],
        },
      ],
    },
    {
      number: 4,
      title: 'Purpose and Legal Basis for Processing',
      blocks: [
        {
          type: 'paragraph',
          text: 'Personal information collected through Deliverex is processed for the following legitimate purposes:',
        },
        {
          type: 'list',
          items: [
            'Account creation and authentication — to verify user identity and provide role-appropriate access to the Deliverex system.',
            'Delivery coordination and tracking — to facilitate fleet dispatch optimization, delivery status monitoring, and delivery visibility for authorized users and customers.',
            'Documentation processing — to capture, extract, validate, and store delivery documents using OCR technology for billing, accountability, and audit purposes.',
            'Operational reporting — to generate dashboards, performance reports, and KPI summaries for management oversight.',
            'Customer service — to enable customers to track deliveries, access proof of delivery documents, and submit inquiries through the chatbot.',
            'System security and audit — to log authentication events, system access, and operational actions for accountability and security purposes.',
          ],
        },
        {
          type: 'paragraph',
          text: 'Processing of personal information in Deliverex is grounded on the following lawful bases under Section 13 of RA 10173:',
        },
        {
          type: 'list',
          items: [
            'Consent of the data subject — customers provide explicit consent to this policy during account registration.',
            'Fulfillment of a contract — processing is necessary to deliver the logistics coordination and tracking services requested by the data subject.',
            'Legitimate interest — processing of internal user data is necessary for the lawful operational purposes of Providential 628 Site Preparation Services.',
          ],
        },
      ],
    },
    {
      number: 5,
      title: 'Data We Do Not Collect',
      blocks: [
        {
          type: 'paragraph',
          text: 'Deliverex does not collect any sensitive personal information as defined under Section 3(l) of RA 10173, including information about racial or ethnic origin, political beliefs, religious or philosophical beliefs, health or medical records, genetic data, sexual life, or government-issued identification numbers (SSS, TIN, GSIS, Passport).',
        },
        {
          type: 'paragraph',
          text: 'Deliverex does not collect payment or financial information of any kind.',
        },
        {
          type: 'paragraph',
          text: 'Deliverex does not engage in automated profiling or algorithmic decision-making that produces legal effects on data subjects.',
        },
      ],
    },
    {
      number: 6,
      title: 'Who Has Access to Your Personal Information',
      blocks: [
        {
          type: 'paragraph',
          text: 'Access to personal information within Deliverex is strictly governed by role-based access controls. Only the following authorized personnel may access personal data, and only to the extent required by their operational role:',
        },
        {
          type: 'list',
          items: [
            'Administrator — full access to user account records, driver and vehicle master data, OCR documents, audit logs, and system configuration.',
            'Dispatcher — access to job order details, driver and vehicle assignment records, and delivery status information.',
            'Manager — read-only access to delivery records, performance reports, and fleet utilization data.',
            'Driver — access to their own assigned job details and delivery records through the mobile application.',
            'Customer — access to their own delivery transaction history, active delivery status, and proof of delivery documents only.',
          ],
        },
        {
          type: 'paragraph',
          text: 'Personal information processed through Deliverex is not sold, rented, traded, or disclosed to any unauthorized third party. Data may be shared with third-party service providers engaged to support the technical operation of the system — such as cloud hosting and database service providers — solely for the purpose of providing the contracted services, and subject to confidentiality and data protection obligations consistent with RA 10173.',
        },
      ],
    },
    {
      number: 7,
      title: 'Data Retention',
      blocks: [
        {
          type: 'paragraph',
          text: 'Personal information collected through Deliverex is retained for the period necessary to fulfill the purposes for which it was collected, consistent with the operational and legal requirements of Providential 628 Site Preparation Services.',
        },
        {
          type: 'list',
          items: [
            'Active customer account data is retained for the duration of the customer\'s registered account.',
            'Delivery transaction records and proof of delivery documents are retained for the duration required by operational accountability, audit, and billing purposes.',
            'Driver records are retained for the duration of the driver\'s active employment or engagement with Providential 628 Site Preparation Services.',
            'Audit logs and session activity records are retained for a minimum of one year for security and accountability purposes.',
          ],
        },
        {
          type: 'paragraph',
          text: 'Upon the expiry of the retention period or upon a valid and processed erasure request, personal information will be securely deleted or anonymized from Deliverex system records.',
        },
      ],
    },
    {
      number: 8,
      title: 'Your Rights as a Data Subject',
      blocks: [
        {
          type: 'paragraph',
          text: 'As a data subject under RA 10173, you are entitled to exercise the following rights with respect to your personal information processed through Deliverex:',
        },
        {
          type: 'list',
          items: [
            'Right to Be Informed — you have the right to know whether your personal information is being collected and processed, and to be notified of the purpose, scope, and method of processing before data collection occurs.',
            'Right to Access — you have the right to request a copy of the personal information Deliverex holds about you, including the manner in which it has been processed.',
            'Right to Correction — you have the right to request correction of any inaccurate, incomplete, outdated, or misleading personal information held about you in the Deliverex system.',
            'Right to Erasure — you have the right to request the deletion or blocking of personal information where there is no longer a legal or operational basis for its continued processing, subject to applicable legal retention requirements.',
            'Right to Object — you have the right to object to the processing of your personal information for purposes not directly related to the delivery services you have engaged.',
            'Right to Data Portability — you have the right to request a copy of your personal data in a structured and commonly used format for transfer to another service provider, where technically feasible.',
            'Right to Damages — you have the right to claim compensation for any damages sustained as a result of inaccurate, incomplete, outdated, or unlawfully obtained or processed personal information.',
            'Right to File a Complaint — you have the right to file a complaint with the National Privacy Commission (NPC) if you believe your data privacy rights have been violated.',
          ],
        },
        {
          type: 'paragraph',
          text: 'To exercise any of the above rights, submit a written request to the Deliverex system administrator through the official contact channels of Providential 628 Site Preparation Services. Requests will be acknowledged and acted upon within a reasonable period consistent with the requirements of RA 10173 and its IRR.',
        },
      ],
    },
    {
      number: 9,
      title: 'Data Security',
      blocks: [
        {
          type: 'paragraph',
          text: 'Providential 628 Site Preparation Services implements reasonable and appropriate technical and organizational security measures to protect personal information processed through Deliverex from unauthorized access, disclosure, alteration, destruction, or misuse. These measures include:',
        },
        {
          type: 'list',
          items: [
            'Role-based access controls ensuring that users can only access personal data relevant to their designated operational role within the system.',
            'JWT-based session management with short-lived access tokens and refresh token rotation, ensuring that session credentials are time-limited and automatically invalidated upon logout or account deactivation.',
            'Encrypted local storage of session tokens on the native Android mobile application using the Android Keystore, protecting credentials stored on the device from unauthorized access.',
            'Secure transmission of data between client applications and the server through HTTPS encryption.',
            'Centralized audit logging of all system access events, authentication activities, and data modification actions for accountability and forensic review purposes.',
            'Password complexity enforcement requiring a minimum of eight characters including uppercase, lowercase, numeric, and special characters.',
            'Account lockout after five consecutive failed login attempts, with administrator-assisted or email-based account recovery.',
          ],
        },
        {
          type: 'paragraph',
          text: 'While Providential 628 Site Preparation Services implements appropriate security measures, no system or network is completely immune to security risks. Users are encouraged to maintain the confidentiality of their login credentials and to report any suspected unauthorized access to the system administrator immediately.',
        },
      ],
    },
    {
      number: 10,
      title: 'Data Breach Notification',
      blocks: [
        {
          type: 'paragraph',
          text: 'In the event of a personal data breach that is likely to result in serious harm to the rights and freedoms of affected data subjects, Providential 628 Site Preparation Services shall:',
        },
        {
          type: 'list',
          items: [
            'Notify the National Privacy Commission (NPC) within seventy-two (72) hours of becoming aware of the breach, in accordance with NPC Circular No. 16-03.',
            'Notify affected data subjects of the nature of the breach, the personal information involved, the measures taken to address the breach, and the contact details of the data protection officer or the system administrator, without undue delay.',
            'Document all known facts relating to the breach, including its nature, the categories and approximate number of data subjects and records affected, and the measures taken or proposed to address the breach.',
          ],
        },
      ],
    },
    {
      number: 11,
      title: 'Third-Party Services',
      blocks: [
        {
          type: 'paragraph',
          text: 'The Deliverex system may utilize the following third-party services in its operation:',
        },
        {
          type: 'list',
          items: [
            'Cloud hosting and database services — for the storage and processing of Deliverex application data. These providers are engaged as Personal Information Processors and are bound by data processing agreements consistent with the requirements of RA 10173.',
            'Google Maps Platform — for delivery destination mapping and distance calculation features within the customer tracking interface. Location data used for map display is limited to delivery destination addresses and optionally recorded driver GPS coordinates at the time of status updates. No user location data is continuously transmitted to or stored by Google beyond the operational requirements of the mapping feature.',
            'Tesseract OCR Engine — for automated text extraction from uploaded delivery documents. Document images are processed on the server and are not transmitted to any third-party OCR service.',
          ],
        },
        {
          type: 'paragraph',
          text: 'Providential 628 Site Preparation Services does not sell or transfer personal information to any third party for marketing, advertising, or commercial purposes.',
        },
      ],
    },
    {
      number: 12,
      title: 'Consent',
      blocks: [
        {
          type: 'paragraph',
          text: 'By registering an account on the Deliverex system — whether through the web application or the native Android mobile application — you confirm that:',
        },
        {
          type: 'list',
          items: [
            'You have read and understood this Data Privacy Policy.',
            'You freely and voluntarily give your consent to the collection, processing, and storage of your personal information as described in this policy.',
            'You are at least eighteen (18) years of age, or have obtained the consent of a parent or legal guardian if you are below the age of majority.',
          ],
        },
        {
          type: 'paragraph',
          text: 'Your consent may be withdrawn at any time by submitting a written request for account deactivation to the Deliverex system administrator. Withdrawal of consent does not affect the lawfulness of processing carried out prior to the withdrawal.',
        },
      ],
    },
    {
      number: 13,
      title: 'Changes to This Policy',
      blocks: [{
        type: 'paragraph',
        text: 'Providential 628 Site Preparation Services reserves the right to update or amend this Data Privacy Policy as required by changes in applicable laws, regulations, or the operational scope of the Deliverex system. In the event of material changes to this policy, registered users will be notified through the Deliverex system or via email prior to the changes taking effect. Continued use of the Deliverex system after notification of changes constitutes acceptance of the updated policy. If you do not agree with the updated terms, you may exercise your right to request account deactivation as described in Section 12.',
      }],
    },
    {
      number: 14,
      title: 'Contact Information',
      blocks: [{
        type: 'paragraph',
        text: 'For questions, concerns, or requests related to this Data Privacy Policy or the processing of your personal information through Deliverex, please contact:',
      }],
    },
  ],
  contact: {
    organization: 'Providential 628 Site Preparation Services',
    system: 'Deliverex',
    contact: 'Joeylyn Mercado',
    email: 'deliverexapp@gmail.com',
    address: '7353 CASA ZARAGOZA CLUSTER 3 COMMONWEALTH AVENUE EXTENSION SAN BENISSA GARDEN VILLAS KALIGAYAHAN DISTRICT 5, QUEZON CITY 1124',
  },
  contactExtra: {
    title: 'National Privacy Commission (NPC)',
    items: [
      { label: 'Website', value: 'www.privacy.gov.ph' },
      { label: 'Email', value: 'info@privacy.gov.ph' },
      { label: 'Address', value: '5th Floor, Delegation Building, PICC Complex, Roxas Boulevard, Pasay City, Metro Manila, Philippines' },
    ],
    intro: 'You may also file a complaint or inquiry directly with the National Privacy Commission of the Philippines:',
  },
  closing: 'This Data Privacy Policy is issued in compliance with Republic Act No. 10173 (Data Privacy Act of 2012) and its Implementing Rules and Regulations issued by the National Privacy Commission of the Philippines.',
  copyright: '© 2026 Providential 628 Site Preparation Services. All rights reserved.',
}
