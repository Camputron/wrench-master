/** US states and territories. `key` is the value stored in the database (the Java enum name). */
export interface UsState {
  key: string
  name: string
  abbreviation: string
}

export const US_STATES: UsState[] = [
  { key: 'ALABAMA', name: 'Alabama', abbreviation: 'AL' },
  { key: 'ALASKA', name: 'Alaska', abbreviation: 'AK' },
  { key: 'AMERICAN_SAMOA', name: 'American Samoa', abbreviation: 'AS' },
  { key: 'ARIZONA', name: 'Arizona', abbreviation: 'AZ' },
  { key: 'ARKANSAS', name: 'Arkansas', abbreviation: 'AR' },
  { key: 'CALIFORNIA', name: 'California', abbreviation: 'CA' },
  { key: 'COLORADO', name: 'Colorado', abbreviation: 'CO' },
  { key: 'CONNECTICUT', name: 'Connecticut', abbreviation: 'CT' },
  { key: 'DELAWARE', name: 'Delaware', abbreviation: 'DE' },
  { key: 'DISTRICT_OF_COLUMBIA', name: 'District of Columbia', abbreviation: 'DC' },
  { key: 'FEDERATED_STATES_OF_MICRONESIA', name: 'Federated States of Micronesia', abbreviation: 'FM' },
  { key: 'FLORIDA', name: 'Florida', abbreviation: 'FL' },
  { key: 'GEORGIA', name: 'Georgia', abbreviation: 'GA' },
  { key: 'GUAM', name: 'Guam', abbreviation: 'GU' },
  { key: 'HAWAII', name: 'Hawaii', abbreviation: 'HI' },
  { key: 'IDAHO', name: 'Idaho', abbreviation: 'ID' },
  { key: 'ILLINOIS', name: 'Illinois', abbreviation: 'IL' },
  { key: 'INDIANA', name: 'Indiana', abbreviation: 'IN' },
  { key: 'IOWA', name: 'Iowa', abbreviation: 'IA' },
  { key: 'KANSAS', name: 'Kansas', abbreviation: 'KS' },
  { key: 'KENTUCKY', name: 'Kentucky', abbreviation: 'KY' },
  { key: 'LOUISIANA', name: 'Louisiana', abbreviation: 'LA' },
  { key: 'MAINE', name: 'Maine', abbreviation: 'ME' },
  { key: 'MARYLAND', name: 'Maryland', abbreviation: 'MD' },
  { key: 'MARSHALL_ISLANDS', name: 'Marshall Islands', abbreviation: 'MH' },
  { key: 'MASSACHUSETTS', name: 'Massachusetts', abbreviation: 'MA' },
  { key: 'MICHIGAN', name: 'Michigan', abbreviation: 'MI' },
  { key: 'MINNESOTA', name: 'Minnesota', abbreviation: 'MN' },
  { key: 'MISSISSIPPI', name: 'Mississippi', abbreviation: 'MS' },
  { key: 'MISSOURI', name: 'Missouri', abbreviation: 'MO' },
  { key: 'MONTANA', name: 'Montana', abbreviation: 'MT' },
  { key: 'NEBRASKA', name: 'Nebraska', abbreviation: 'NE' },
  { key: 'NEVADA', name: 'Nevada', abbreviation: 'NV' },
  { key: 'NEW_HAMPSHIRE', name: 'New Hampshire', abbreviation: 'NH' },
  { key: 'NEW_JERSEY', name: 'New Jersey', abbreviation: 'NJ' },
  { key: 'NEW_MEXICO', name: 'New Mexico', abbreviation: 'NM' },
  { key: 'NEW_YORK', name: 'New York', abbreviation: 'NY' },
  { key: 'NORTH_CAROLINA', name: 'North Carolina', abbreviation: 'NC' },
  { key: 'NORTH_DAKOTA', name: 'North Dakota', abbreviation: 'ND' },
  { key: 'NORTHERN_MARIANA_ISLANDS', name: 'Northern Mariana Islands', abbreviation: 'MP' },
  { key: 'OHIO', name: 'Ohio', abbreviation: 'OH' },
  { key: 'OKLAHOMA', name: 'Oklahoma', abbreviation: 'OK' },
  { key: 'OREGON', name: 'Oregon', abbreviation: 'OR' },
  { key: 'PALAU', name: 'Palau', abbreviation: 'PW' },
  { key: 'PENNSYLVANIA', name: 'Pennsylvania', abbreviation: 'PA' },
  { key: 'PUERTO_RICO', name: 'Puerto Rico', abbreviation: 'PR' },
  { key: 'RHODE_ISLAND', name: 'Rhode Island', abbreviation: 'RI' },
  { key: 'SOUTH_CAROLINA', name: 'South Carolina', abbreviation: 'SC' },
  { key: 'SOUTH_DAKOTA', name: 'South Dakota', abbreviation: 'SD' },
  { key: 'TENNESSEE', name: 'Tennessee', abbreviation: 'TN' },
  { key: 'TEXAS', name: 'Texas', abbreviation: 'TX' },
  { key: 'UTAH', name: 'Utah', abbreviation: 'UT' },
  { key: 'VERMONT', name: 'Vermont', abbreviation: 'VT' },
  { key: 'VIRGIN_ISLANDS', name: 'Virgin Islands', abbreviation: 'VI' },
  { key: 'VIRGINIA', name: 'Virginia', abbreviation: 'VA' },
  { key: 'WASHINGTON', name: 'Washington', abbreviation: 'WA' },
  { key: 'WEST_VIRGINIA', name: 'West Virginia', abbreviation: 'WV' },
  { key: 'WISCONSIN', name: 'Wisconsin', abbreviation: 'WI' },
  { key: 'WYOMING', name: 'Wyoming', abbreviation: 'WY' },
  { key: 'UNKNOWN', name: 'Unknown', abbreviation: '' }
]

export function stateByKey(key: string): UsState | undefined {
  return US_STATES.find((s) => s.key === key)
}
