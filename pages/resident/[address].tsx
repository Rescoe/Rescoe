import { Default } from 'components/layouts/Default';
import ResidentDashboard   from 'components/containers/residents/residentsAddress/[address]';

const ResidentProfilePage = () => {
  return (
    <Default pageName="Résident">
      <ResidentDashboard  />
    </Default>
  );
};

export default ResidentProfilePage;
