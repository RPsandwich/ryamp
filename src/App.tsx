import { useAudioPlayer } from './hooks/useAudioPlayer';
import { useVisualizer } from './hooks/useVisualizer';
import { useLibrary } from './hooks/useLibrary';
import { useSkin } from './hooks/useSkin';
import { Sidebar } from './components/Sidebar';
import { Visualizer } from './components/Visualizer';
import { TransportControls } from './components/TransportControls';
import { TrackTable } from './components/TrackTable';
import { AvatarBanner } from './components/AvatarBanner';

function App() {
  const player = useAudioPlayer();
  const visualizer = useVisualizer(player.analyserRef, player.isPlaying);
  const lib = useLibrary();
  const skin = useSkin();

  return (
    <div style={{ height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '2rem' }}>
      <div style={{ flexShrink: 0 }}>
        <AvatarBanner src={skin.avatarSrc} />
      </div>

      <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start', flex: 1, minHeight: 0 }}>
        <div style={{ flexShrink: 0, height: '100%', overflowY: 'auto' }}>
          <Sidebar
            libraryCount={lib.library.length}
            albumsCount={lib.albums.length}
            view={lib.view}
            playlists={lib.playlists}
            newPlaylistName={lib.newPlaylistName}
            setNewPlaylistName={lib.setNewPlaylistName}
            createPlaylist={lib.createPlaylist}
            deletePlaylist={lib.deletePlaylist}
            selectPlaylist={lib.selectPlaylist}
            openAlbums={lib.openAlbums}
            pickFolder={lib.pickFolder}
            isImporting={lib.isImporting}
            selectedFolder={lib.selectedFolder}
            importStatus={lib.importStatus}
            themes={skin.themes}
            themeId={skin.themeId}
            setThemeId={skin.setThemeId}
            saveCustomTheme={skin.saveCustomTheme}
            deleteCustomTheme={skin.deleteCustomTheme}
            bannerPresets={skin.bannerPresets}
            userBanners={skin.userBanners}
            avatarSource={skin.avatarSource}
            avatarSrc={skin.avatarSrc}
            pickAvatarImage={skin.pickAvatarImage}
            selectBannerPreset={skin.selectBannerPreset}
            selectUserBanner={skin.selectUserBanner}
            deleteUserBanner={skin.deleteUserBanner}
            clearAvatar={skin.clearAvatar}
          />
        </div>

        <div style={{ flex: 1, minWidth: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
          <div style={{ flexShrink: 0 }}>
            <Visualizer
              canvasRef={visualizer.visualizerCanvasRef}
              mode={visualizer.visualizerMode}
              setMode={visualizer.setVisualizerMode}
              colorMode={visualizer.colorMode}
              setColorMode={visualizer.setColorMode}
            />

            <TransportControls
              currentTrack={player.currentTrack}
              isPlaying={player.isPlaying}
              skipPrevious={player.skipPrevious}
              togglePlay={player.togglePlay}
              skipNext={player.skipNext}
              shuffleOn={player.shuffleOn}
              toggleShuffle={player.toggleShuffle}
              repeatMode={player.repeatMode}
              cycleRepeat={player.cycleRepeat}
              currentTime={player.currentTime}
              duration={player.duration}
              seek={player.seek}
            />
          </div>

          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            <TrackTable
              view={lib.view}
              albums={lib.albums}
              openAlbum={lib.openAlbum}
              openAlbums={lib.openAlbums}
              headerLabel={lib.headerLabel}
              displayedTracks={lib.displayedTracks}
              currentTrack={player.currentTrack}
              sortKey={lib.sortKey}
              sortDir={lib.sortDir}
              handleSort={lib.handleSort}
              selectAndPlay={player.selectAndPlay}
              playlists={lib.playlists}
              addTrackToPlaylist={lib.addTrackToPlaylist}
              removeTrackFromPlaylist={lib.removeTrackFromPlaylist}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
