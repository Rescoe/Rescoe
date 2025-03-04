import { Default } from 'components/layouts/Default';
import TokenId from 'components/containers/oeuvresId/[tokenId]';

const OeuvresIdPages: React.FC = () =>{
  return (
    <Default pageName="oeuvresId">
      <TokenId />
    </Default>
  );
};

export default OeuvresIdPages;
