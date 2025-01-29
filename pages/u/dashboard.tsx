import React from 'react';
import { Default } from 'components/layouts/Default';
import DashBoard from 'components/containers/dashboard/DashBoard';

const DashboardPage = () => {
  return (
    <Default pageName="Dashboard">
      <DashBoard />
    </Default>
  );
};

export default DashboardPage;
