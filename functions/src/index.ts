import { setGlobalOptions } from 'firebase-functions/v2'
import { processUploadedDocument } from './documents'
import { claimInitialAdmin, setEmployeeRole } from './roles'
import { searchKnowledge } from './search'

setGlobalOptions({ region: 'us-central1', maxInstances: 10 })

export { claimInitialAdmin, processUploadedDocument, searchKnowledge, setEmployeeRole }
