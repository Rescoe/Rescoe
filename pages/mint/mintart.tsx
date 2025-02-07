import { Default } from 'components/layouts/Default';
import { MintArt } from 'components/containers/mint/mintart';
import type { NextPage } from 'next';


const MintArtPage : NextPage = () => {
  return (
    <Default pageName="MintArt">
      <MintArt />
    </Default>
  );
};

export default MintArtPage;
