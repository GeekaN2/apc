import { Button, Text } from '@gravity-ui/uikit'
import styles from './MainPage.module.css'
import { Footer } from './Footer/Footer'

export const MainPage: React.FC = () => {

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <img src='/assets/favicon.png' className={styles.logo}></img>
        <Text variant='display-4' color='complementary'>Albion Profit Calculator</Text>
      </div>
      <div className={styles.pages}>
        <Button className={styles.pageButton} view='outlined' size='l'>🌳 Profit tree</Button>
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
