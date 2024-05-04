import React from 'react'
import ReactDOM from 'react-dom/client'
import { MainPage } from './components/MainPage/MainPage.tsx'
import './index.css'

import '@gravity-ui/uikit/styles/fonts.css';
import '@gravity-ui/uikit/styles/styles.css';
import { ThemeProvider } from '@gravity-ui/uikit';
import { RouterProvider, createBrowserRouter } from 'react-router-dom';
import { ProfitTreePage } from './components/ProfitTreePage/ProfitTreePage.tsx';
import { userStore } from './store/index.ts';
import { observer } from 'mobx-react';

const router = createBrowserRouter([
  {
    path: "/",
    element: <MainPage />,
  },
  {
    path: "/tree",
    element: <ProfitTreePage />
  }
]);


const Root: React.FC = observer(() => <React.StrictMode>
  <ThemeProvider theme={userStore.theme}>
    <RouterProvider router={router} />
  </ThemeProvider>
</React.StrictMode>)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <Root />
)
