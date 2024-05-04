import { Button, Text } from '@gravity-ui/uikit'
import styles from './MainPage.module.css'
import { Footer } from './Footer/Footer'
import { useNavigate } from 'react-router-dom'

export const MainPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <img src='/public/favicon.png' className={styles.logo}></img>
        <Text variant='display-4' color='complementary'>Albion Profit Calculator</Text>
      </div>
      <div className={styles.pages}>
        <Button className={styles.pageButton} view='outlined' size='l' onClick={() => navigate('/tree')}>🌳 Profit tree</Button>
        <Button className={styles.pageButton} view='outlined' size='l'>🐗 Transportations</Button>
        <Button className={styles.pageButton} view='outlined' size='l'>♻️ Refining</Button>
        <Button className={styles.pageButton} view='outlined' size='l'>🍲 Food & potions</Button>
        <Button className={styles.pageButton} view='outlined' size='l'>🧪 Transmutations</Button>
        <Button className={styles.pageButton} view='outlined' size='l'>🗿 Atrifact foundry</Button>
        <Button className={styles.helpersButton} view='outlined' size='l'>⚙️ Servers </Button>
        <Button className={styles.helpersButton} view='outlined' size='l'>❓ FAQ</Button>
      </div>
      <Footer />
    </div>
  )
}
