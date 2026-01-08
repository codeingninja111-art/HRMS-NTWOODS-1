import React from 'react';
import { Toaster } from 'react-hot-toast';

export function Toasts() {
  return <Toaster position="top-right" toastOptions={{ duration: 4000 }} />;
}
