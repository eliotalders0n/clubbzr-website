import { StoreShell } from '@/components/features/store/StoreShell'
import { StoreCatalog } from '@/components/features/store/StoreCatalog'
export default function Store() {
  return <StoreShell>
    <StoreCatalog featured heading="Featured releases" />
    <StoreCatalog heading="Explore recent releases" />
  </StoreShell>
}
