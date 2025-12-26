import { motion } from "framer-motion";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import TrialBanner from "@/components/dashboard/TrialBanner";
import { useAuth } from "@/hooks/useAuth";
import { 
  HardDrive, 
  Download, 
  Link2, 
  Users,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  MoreHorizontal,
  FolderOpen,
  FileVideo,
  FileImage,
  FileText as FileTextIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";

const stats = [
  {
    label: "Storage Used",
    value: "24.5 GB",
    limit: "/ 50 GB",
    change: "+2.4 GB",
    trend: "up",
    icon: HardDrive,
    color: "from-primary to-cyan-400"
  },
  {
    label: "Bandwidth",
    value: "156.2 GB",
    limit: "/ 500 GB",
    change: "+12.8 GB",
    trend: "up",
    icon: Download,
    color: "from-violet-500 to-purple-400"
  },
  {
    label: "Active Links",
    value: "47",
    limit: "/ 100",
    change: "+5",
    trend: "up",
    icon: Link2,
    color: "from-amber-500 to-orange-400"
  },
  {
    label: "Total Views",
    value: "12.4K",
    limit: "",
    change: "+18%",
    trend: "up",
    icon: Users,
    color: "from-emerald-500 to-teal-400"
  },
];

const recentFiles = [
  { name: "Product Demo 2024.mp4", type: "video", size: "245 MB", date: "2 hours ago" },
  { name: "Brand Guidelines.pdf", type: "document", size: "12.4 MB", date: "5 hours ago" },
  { name: "Marketing Assets", type: "folder", size: "1.2 GB", date: "Yesterday" },
  { name: "Hero Banner.png", type: "image", size: "4.8 MB", date: "2 days ago" },
];

const getFileIcon = (type: string) => {
  switch (type) {
    case "video": return FileVideo;
    case "image": return FileImage;
    case "folder": return FolderOpen;
    default: return FileTextIcon;
  }
};

const Dashboard = () => {
  const { profile, subscription, daysRemaining } = useAuth();
  
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Trial Banner */}
        <TrialBanner />

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground">
              Welcome back{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}! 
              {subscription?.plan === 'free' && daysRemaining !== null && (
                <span className="ml-2 text-amber-500">
                  ({daysRemaining} days left in trial)
                </span>
              )}
            </p>
          </div>
          <Button variant="hero">
            Upload Files
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1, duration: 0.4 }}
              className="p-5 rounded-xl bg-card border border-border hover:border-primary/30 transition-all duration-300"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${stat.color} p-2.5`}>
                  <stat.icon className="w-full h-full text-white" />
                </div>
                <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full
                  ${stat.trend === "up" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}
                `}>
                  {stat.trend === "up" ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {stat.change}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-foreground">{stat.value}</span>
                  {stat.limit && <span className="text-sm text-muted-foreground">{stat.limit}</span>}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Files */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.4 }}
            className="lg:col-span-2 p-6 rounded-xl bg-card border border-border"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-foreground">Recent Files</h2>
              <Button variant="ghost" size="sm">
                View All
              </Button>
            </div>

            <div className="space-y-3">
              {recentFiles.map((file, index) => {
                const Icon = getFileIcon(file.type);
                return (
                  <motion.div
                    key={file.name}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + index * 0.1, duration: 0.3 }}
                    className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                      <Icon className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                      <p className="text-xs text-muted-foreground">{file.size}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">{file.date}</p>
                    <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.4 }}
            className="p-6 rounded-xl bg-card border border-border"
          >
            <h2 className="text-lg font-semibold text-foreground mb-6">Quick Actions</h2>
            
            <div className="space-y-3">
              <Button variant="outline" className="w-full justify-start gap-3 h-12">
                <FolderOpen className="w-5 h-5 text-primary" />
                Create Folder
              </Button>
              <Button variant="outline" className="w-full justify-start gap-3 h-12">
                <Link2 className="w-5 h-5 text-primary" />
                Generate Share Link
              </Button>
              <Button variant="outline" className="w-full justify-start gap-3 h-12">
                <TrendingUp className="w-5 h-5 text-primary" />
                View Analytics
              </Button>
            </div>

            {/* Storage indicator */}
            <div className="mt-6 pt-6 border-t border-border">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-muted-foreground">Storage</span>
                <span className="font-medium text-foreground">24.5 / 50 GB</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div 
                  className="h-full rounded-full gradient-primary transition-all duration-500"
                  style={{ width: "49%" }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                49% of storage used
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
