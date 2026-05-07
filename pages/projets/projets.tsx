import { Default } from 'components/layouts/Default';
import Projets from 'components/containers/projets/Projets';

const ProjetPage = () => {
  return (
    <Default pageName="Projets">
      <Projets channelId="NEXT_PUBLIC_CHANNEL_EXPOS_ID" limit={20} />
    </Default>
  );
};

export default ProjetPage;
