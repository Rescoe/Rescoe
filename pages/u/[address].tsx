import { Default } from 'components/layouts/Default';
import PublicProfile from 'components/containers/dashboard/[address]';

const UserProfilePage = () => {
  return (
    <Default pageName="profil-public">
      <PublicProfile />
    </Default>
  );
};

export default UserProfilePage;
