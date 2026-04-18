import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AsideHeader, FooterItem } from '@gravity-ui/navigation';
import { useMediaQuery } from '../hooks/useMediaQuery';
import {
  Server,
  ArrowRightFromSquare,
  Gear,
  PlugConnection,
  ListUl,
  ChartBar,
  FileText,
} from '@gravity-ui/icons';
import { logout } from '../api';
import GlobalSearch from './GlobalSearch';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const isNarrow = useMediaQuery('(max-width: 900px)');
  const [compact, setCompact] = useState(isNarrow);

  useEffect(() => {
    setCompact(isNarrow);
  }, [isNarrow]);

  const currentPath = location.pathname;

  const menuItems = [
    {
      id: 'dashboard',
      title: 'Сводка',
      icon: ChartBar,
      current: currentPath === '/dashboard',
      onItemClick: () => navigate('/dashboard'),
    },
    {
      id: 'nodes',
      title: 'Ноды',
      icon: Server,
      current: currentPath === '/nodes' || currentPath.startsWith('/nodes/'),
      onItemClick: () => navigate('/nodes'),
    },
    {
      id: 'proxies',
      title: 'Прокси',
      icon: PlugConnection,
      current: currentPath === '/proxies',
      onItemClick: () => navigate('/proxies'),
    },
    {
      id: 'docs',
      title: 'Справка',
      icon: FileText,
      current: currentPath === '/docs',
      onItemClick: () => navigate('/docs'),
    },
    {
      id: 'settings',
      title: 'Настройки',
      icon: Gear,
      current: currentPath === '/settings',
      onItemClick: () => navigate('/settings'),
    },
    {
      id: 'audit',
      title: 'Аудит',
      icon: ListUl,
      current: currentPath === '/audit',
      onItemClick: () => navigate('/audit'),
    },
  ];

  return (
    <AsideHeader
      className="app-aside-header"
      compact={compact}
      onChangeCompact={setCompact}
      menuItems={menuItems}
      logo={{
        text: 'MTProto Panel',
        className: 'app-logo-text',
      }}
      renderContent={() => (
        <div className="app-content">
          <div className="app-content-toolbar">
            <GlobalSearch />
          </div>
          {children}
        </div>
      )}
      renderFooter={({ compact: isCompact }) => (
        <FooterItem
          compact={isCompact}
          item={{
            id: 'logout',
            title: 'Выход',
            icon: ArrowRightFromSquare,
            onItemClick: () => logout(),
          }}
        />
      )}
    />
  );
}
