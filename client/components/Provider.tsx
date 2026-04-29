import { AuthProvider } from '@/contexts/AuthContext';
import { type ReactNode } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

function Provider({ children }: { children: ReactNode }) {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        {children}
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

export {
  Provider,
}
