import { useEffect, useState } from 'react';
import { db, hasFirebaseConfig } from '@/lib/firebase';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

export function FirebaseStatus() {
  const [status, setStatus] = useState<'checking' | 'connected' | 'error' | 'no-config'>('checking');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!hasFirebaseConfig || !db) {
      setStatus('no-config');
      return;
    }

    // Test Firebase connection by attempting to read from a collection
    import('firebase/firestore').then(({ collection, getDocs }) => {
      const testCollection = collection(db, 'test');
      getDocs(testCollection)
        .then(() => {
          setStatus('connected');
        })
        .catch((err) => {
          setStatus('error');
          setError(err.message);
        });
    });
  }, []);

  if (status === 'checking') {
    return (
      <Alert className="mb-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Checking Firebase connection...
        </AlertDescription>
      </Alert>
    );
  }

  if (status === 'no-config') {
    return (
      <Alert variant="destructive" className="mb-4">
        <XCircle className="h-4 w-4" />
        <AlertDescription>
          Firebase is not configured. Please provide Firebase credentials to enable real-time data storage.
        </AlertDescription>
      </Alert>
    );
  }

  if (status === 'error') {
    return (
      <Alert variant="destructive" className="mb-4">
        <XCircle className="h-4 w-4" />
        <AlertDescription>
          Firebase connection failed: {error}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert className="mb-4 border-green-200 bg-green-50">
      <CheckCircle className="h-4 w-4 text-green-600" />
      <AlertDescription className="text-green-800">
        Firebase connected successfully
      </AlertDescription>
    </Alert>
  );
}