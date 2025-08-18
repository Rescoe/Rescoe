import { Default } from 'components/layouts/Default';
import TokenId from 'components/containers/poemsId/[tokenId]';

const PoemsIdPages: React.FC = () =>{
  return (
    <Default pageName="poemsId">
      <TokenId />
    </Default>
  );
};

export default PoemsIdPages;
