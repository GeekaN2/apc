import { Switch, useTheme } from '@gravity-ui/uikit';
import styles from './Footer.module.css';
import { userStore } from '../../../store';
import { observer } from 'mobx-react';

export const Footer: React.FC = observer(() => {
  const theme = useTheme();

  return (
    <footer className={styles.footer}>
      <span>&copy; GeekaN</span>
      <Switch
        checked={theme === 'dark'}
        onChange={(event) => {
          userStore.setTheme(event.target.checked ? 'dark' : 'light')
        }}
      >Theme</Switch>
    </footer>
  )
})